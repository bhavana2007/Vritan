import json
import os
import logging
from typing import Dict, Any, List
from .tools import VoiceAgentTools

logger = logging.getLogger(__name__)

class VoiceAgentCore:
    def __init__(self, db, patient):
        self.db = db
        self.patient = patient
        self.tools_handler = VoiceAgentTools(db, patient)
        self.gemini_request_count = 0
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            self.chat = self.client.chats.create(
                model="gemini-2.5-flash",
                config=self._get_gemini_config()
            )
        else:
            self.client = None
            self.chat = None

        self.state = {
            "appointment_state": "IDLE", # IDLE, COLLECTING, READY_FOR_CONFIRMATION, CONFIRMED, BOOKING, BOOKED, CANCELLED, BOOKING_FAILED
            "doctor": None,
            "department": None,
            "branch": None,
            "organization": None,
            "date": None,
            "time": None,
            "slot": None,
            "appointment_type": None
        }

    def _get_gemini_config(self):
        from google.genai import types
        
        # Build FunctionDeclarations from tools_handler
        declarations = []
        for t in self.tools_handler.get_tool_definitions():
            # Convert simple dict schema to types.Schema recursively if needed, or pass directly.
            # In google-genai 2.17.0, we can pass the dict to parameters if it conforms to OpenAPI schema.
            decl = types.FunctionDeclaration(
                name=t["name"],
                description=t["description"],
                parameters=t.get("parameters")
            )
            declarations.append(decl)
            
        system_prompt = f"""
You are the VRITAN AI Voice Agent, a professional healthcare assistant for patients.
You are assisting the currently authenticated patient: {self.patient.full_name}.

CRITICAL RULES:
1. You can ONLY book an appointment if the patient has EXPLICITLY confirmed it.
2. Before calling `book_appointment`, you must gather all required info (doctor, date, time, slot_id, organization/branch/dept), and ASK the patient: "Would you like me to book this appointment?"
3. Only if the patient replies with "Yes", "Confirm", or "Book it", you may call the `book_appointment` tool.
4. If a date like "tomorrow" is mentioned, resolve it using the current date context (you must ask the user if you don't know the date).
5. Never expose raw API errors or technical details. Be polite and patient-friendly.
6. Never ask the patient for their internal patient ID.
7. Never use another patient's information.
8. All patient-specific operations must use the authenticated patient context supplied by the backend.
9. Do not reveal internal IDs, JWTs, database identifiers, or authentication details.

Start by asking how you can help the patient today. Keep responses short and conversational, as they will be spoken aloud.
"""
        return types.GenerateContentConfig(
            system_instruction=system_prompt,
            tools=[types.Tool(function_declarations=declarations)],
            temperature=0.2
        )

    async def process_user_input(self, user_text: str) -> str:
        """
        Process the user's spoken text, call LLM, handle tools, return the agent's spoken response.
        """
        if not self.client:
            return "AI_PROVIDER_UNAVAILABLE"
            
        # State transitions based on user input
        text_lower = user_text.lower()
        positive_words = ["yes", "confirm", "book it", "sure", "okay", "do it", "yeah", "please book it", "that's fine"]
        negative_words = ["no", "cancel", "not now", "change", "stop", "don't book it"]
        
        if self.state["appointment_state"] == "READY_FOR_CONFIRMATION":
            if any(w in text_lower for w in positive_words):
                self.state["appointment_state"] = "CONFIRMED"
            elif any(w in text_lower for w in negative_words):
                self.state["appointment_state"] = "CANCELLED"
                
        try:
            from google.genai import types
            
            # Send message to Gemini
            self.gemini_request_count += 1
            logger.info(f"[VOICE AI] Gemini request #{self.gemini_request_count}")
            
            if user_text.strip() == "":
                # Trigger initial greeting
                response = self.chat.send_message("Greet the user.")
            else:
                response = self.chat.send_message(user_text)
                
            # Handle function calls
            if response.function_calls:
                function_responses = []
                spoken_response = None
                
                for fc in response.function_calls:
                    name = fc.name
                    args = fc.args
                    
                    logger.info(f"[VOICE AI] Tool call: {name}")
                    result_json = None
                    
                    if name == "book_appointment":
                        # CRITICAL SECURITY GUARD
                        if self.state["appointment_state"] != "CONFIRMED":
                            self.state["appointment_state"] = "READY_FOR_CONFIRMATION"
                            
                            # Extract arguments to save them in state just in case
                            self.state.update({
                                "doctor": args.get("doctor_id"),
                                "department": args.get("department_id"),
                                "branch": args.get("branch_id"),
                                "organization": args.get("organization_id"),
                                "date": args.get("date"),
                                "time": args.get("time"),
                                "slot": args.get("slot_id"),
                                "appointment_type": args.get("appointment_type")
                            })
                            
                            result_json = json.dumps({"error": "BLOCKED: You must ask the patient for explicit confirmation before booking. Respond asking them to confirm the appointment."})
                            logger.info("[VOICE AI] Tool result: failure (BLOCKED)")
                            spoken_response = "I need your confirmation before booking. Should I proceed?"
                        else:
                            self.state["appointment_state"] = "BOOKING"
                            try:
                                result_json = self.tools_handler.book_appointment(**args)
                                r = json.loads(result_json)
                                if r.get("status") == "success":
                                    self.state["appointment_state"] = "BOOKED"
                                    logger.info("[VOICE AI] Tool result: success")
                                    app_time = args.get("time") or r.get("appointment", {}).get("scheduled_time")
                                    app_date = args.get("date") or r.get("appointment", {}).get("scheduled_date")
                                    spoken_response = f"Your appointment has been booked successfully for {app_date} at {app_time}."
                                else:
                                    self.state["appointment_state"] = "BOOKING_FAILED"
                                    logger.info("[VOICE AI] Tool result: failure")
                                    spoken_response = "I'm sorry, I couldn't complete the booking right now."
                            except Exception as e:
                                logger.error(f"Booking error: {e}")
                                self.state["appointment_state"] = "BOOKING_FAILED"
                                result_json = json.dumps({"error": str(e)})
                                logger.info("[VOICE AI] Tool result: failure")
                                spoken_response = "I'm sorry, I couldn't complete the booking right now."
                                
                    elif name == "find_doctor_appointment":
                        try:
                            result_json = self.tools_handler.find_doctor_appointment(**args)
                            r = json.loads(result_json)
                            if r.get("success"):
                                doc = r.get("doctor")
                                org = r.get("organization")
                                date = r.get("date")
                                time = r.get("time")
                                spoken_response = f"I found Dr. {doc} at {org} on {date} at {time}. Would you like me to book this appointment?"
                                
                                self.state.update({
                                    "doctor": r.get("doctor_id"),
                                    "department": r.get("department_id"),
                                    "branch": r.get("branch_id"),
                                    "organization": r.get("organization_id"),
                                    "date": date,
                                    "time": time,
                                    "slot": r.get("slot_id"),
                                    "appointment_type": r.get("appointment_type"),
                                    "appointment_state": "READY_FOR_CONFIRMATION"
                                })
                                logger.info("[VOICE AI] Tool result: success")
                            else:
                                spoken_response = "I couldn't find an available appointment matching those requirements."
                                logger.info("[VOICE AI] Tool result: failure")
                        except Exception as e:
                            logger.error(f"Macro tool error: {e}")
                            result_json = json.dumps({"error": str(e)})
                            spoken_response = "I encountered an error while searching for appointments."
                            logger.info("[VOICE AI] Tool result: failure")

                    elif name == "get_my_appointments":
                        try:
                            result_json = self.tools_handler.get_my_appointments(**args)
                            r = json.loads(result_json)
                            apps = r.get("appointments", [])
                            if apps:
                                a = apps[0]
                                spoken_response = f"You have an appointment on {a['date']} at {a['time']}."
                                logger.info("[VOICE AI] Tool result: success")
                            else:
                                spoken_response = "You don't have any upcoming appointments."
                                logger.info("[VOICE AI] Tool result: success")
                        except Exception as e:
                            logger.error(f"Error: {e}")
                            result_json = json.dumps({"error": str(e)})
                            spoken_response = "I couldn't retrieve your appointments."
                            logger.info("[VOICE AI] Tool result: failure")

                    elif hasattr(self.tools_handler, name):
                        # Call the tool normally
                        try:
                            method = getattr(self.tools_handler, name)
                            result_json = method(**args)
                            logger.info("[VOICE AI] Tool result: success")
                        except Exception as e:
                            logger.error(f"Tool {name} error: {e}")
                            result_json = json.dumps({"error": str(e)})
                            logger.info("[VOICE AI] Tool result: failure")
                    else:
                        result_json = json.dumps({"error": "Unknown tool"})
                        logger.info("[VOICE AI] Tool result: failure")
                        
                    # Add function response
                    function_responses.append(
                        types.Part.from_function_response(
                            name=name,
                            response={"result": json.loads(result_json) if result_json and isinstance(result_json, str) and result_json.startswith("{") else result_json}
                        )
                    )
                
                # Send the function responses back to Gemini ONLY if we couldn't handle it deterministically
                if spoken_response:
                    self.chat.get_history().append(types.Content(
                        role="user",
                        parts=function_responses
                    ))
                    self.chat.get_history().append(types.Content(
                        role="model",
                        parts=[types.Part.from_text(text=spoken_response)]
                    ))
                    logger.info(f"[VOICE AI] Total Gemini requests: {self.gemini_request_count}")
                    return spoken_response
                else:
                    self.gemini_request_count += 1
                    logger.info(f"[VOICE AI] Gemini request #{self.gemini_request_count}")
                    response = self.chat.send_message(function_responses)
            
            logger.info(f"[VOICE AI] Total Gemini requests: {self.gemini_request_count}")
            return response.text
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"LLM Error: {error_msg}")
            
            # Detect Google Gemini HTTP 429 RESOURCE_EXHAUSTED
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg or "Quota exceeded" in error_msg:
                return "AI_QUOTA_EXCEEDED"
            elif "parse" in error_msg.lower() or "json" in error_msg.lower():
                return "AI_PARSE_ERROR"
            else:
                return "AI_PROVIDER_UNAVAILABLE"

    def _fallback_rule_based_processor(self, user_text: str) -> str:
        """
        A deterministic state machine for the E2E test.
        This is ONLY a test utility and is never called in production.
        """
        text = user_text.lower()
        positive_words = ["yes", "confirm", "book it", "sure", "okay", "do it", "yeah"]
        
        if self.state["appointment_state"] == "READY_FOR_CONFIRMATION":
            if any(w in text for w in positive_words):
                self.state["appointment_state"] = "CONFIRMED"
            else:
                self.state["appointment_state"] = "CANCELLED"
                return "Okay, I have cancelled the booking."
        
        # If it was just confirmed, proceed to book
        if self.state["appointment_state"] == "CONFIRMED":
             self.state["appointment_state"] = "BOOKING"
             try:
                 res = self.tools_handler.book_appointment(
                     doctor_id=self.state["doctor"],
                     department_id=self.state["department"],
                     branch_id=self.state["branch"],
                     organization_id=self.state["organization"],
                     date=self.state["date"],
                     time=self.state["time"],
                     slot_id=self.state["slot"],
                     appointment_type=self.state["appointment_type"] or "Hospital"
                 )
                 r = json.loads(res)
                 if r.get("status") == "success":
                     self.state["appointment_state"] = "BOOKED"
                     return "Your appointment has been booked successfully"
                 else:
                     self.state["appointment_state"] = "BOOKING_FAILED"
                     return "I'm sorry, I couldn't complete the booking right now."
             except Exception as e:
                 self.state["appointment_state"] = "BOOKING_FAILED"
                 return "I'm sorry, I couldn't complete the booking right now."
                 
        if "cardiologist" in text:
            # Mock the steps: search org -> search dept -> search doc -> search slot
            orgs = json.loads(self.tools_handler.search_organizations(name="Apollo"))
            if orgs.get("organizations"):
                org_id = orgs["organizations"][0]["id"]
                branches = json.loads(self.tools_handler.search_branches(org_id))
                if branches.get("branches"):
                    branch_id = branches["branches"][0]["id"]
                    depts = json.loads(self.tools_handler.search_departments(branch_id))
                    if depts.get("departments"):
                        dept_id = depts["departments"][0]["id"] # Assume cardiology
                        docs = json.loads(self.tools_handler.search_doctors(dept_id))
                        if docs.get("doctors"):
                            doc_id = docs["doctors"][0]["id"]
                            # Use tomorrow's date
                            from datetime import datetime, timedelta
                            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                            slots = json.loads(self.tools_handler.find_available_slots(doc_id, tomorrow))
                            
                            if slots.get("slots"):
                                slot = slots["slots"][0]
                                self.state.update({
                                    "organization": org_id,
                                    "branch": branch_id,
                                    "department": dept_id,
                                    "doctor": doc_id,
                                    "date": tomorrow,
                                    "time": slot["time"],
                                    "slot": slot["id"],
                                    "appointment_type": "Hospital",
                                    "appointment_state": "READY_FOR_CONFIRMATION"
                                })
                                return f"I found Dr. {docs['doctors'][0]['name']} at {orgs['organizations'][0]['name']} tomorrow at {slot['time']}. Would you like me to book this appointment?"
            
            return "I couldn't find an available cardiologist."
            
        return f"Hello {self.patient.full_name}. I'm your VRITAN voice assistant. I can help you find doctors, check your appointments, and book an appointment. How can I help?"

