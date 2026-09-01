import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { appointmentsApi } from '../../api/appointments';
import HospitalSearch from './HospitalSearch';
import BranchSelect from './BranchSelect';
import DepartmentSelect from './DepartmentSelect';
import DoctorSelect from './DoctorSelect';
import DateSelect from './DateSelect';
import SlotSelect from './SlotSelect';
import ReviewAppointment from './ReviewAppointment';
import BookingSuccess from './BookingSuccess';

const TypeSelect = ({ onSelect }) => {
    return (
        <div className="max-w-4xl mx-auto py-8">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">Select Appointment Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => onSelect('Hospital')} className="bg-white border rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500 hover:shadow-md transition-all">
                    <span className="text-5xl block mb-2">🏥</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-4">Hospital Visit</h3>
                    <p className="text-slate-500 text-sm mt-2">Book a physical visit at one of our partner hospitals.</p>
                </div>
                <div onClick={() => onSelect('Independent Clinic')} className="bg-white border rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500 hover:shadow-md transition-all">
                    <span className="text-5xl block mb-2">🩺</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-4">Clinic Visit</h3>
                    <p className="text-slate-500 text-sm mt-2">Visit the doctor directly at their private clinic.</p>
                </div>
                <div onClick={() => onSelect('Telemedicine')} className="bg-white border rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500 hover:shadow-md transition-all">
                    <span className="text-5xl block mb-2">💻</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-4">Telemedicine</h3>
                    <p className="text-slate-500 text-sm mt-2">Consult online via video, voice, or chat.</p>
                </div>
            </div>
        </div>
    );
};

const AppointmentWizard = () => {
    const { doctorId: routeDoctorId } = useParams();
    const [searchParams] = useSearchParams();
    const queryDoctorId = searchParams.get('doctorId') || searchParams.get('doctor_id');
    const doctorId = routeDoctorId || queryDoctorId;

    const [appointmentType, setAppointmentType] = useState(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [bookingData, setBookingData] = useState({});
    const [isLoadingDoctor, setIsLoadingDoctor] = useState(false);
    const [doctorLoadError, setDoctorLoadError] = useState(null);

    useEffect(() => {
        if (!doctorId) return;

        // Skip fetch if doctor is already loaded in bookingData and matches the ID
        const currentDoctorId = bookingData.doctor?.user_id || bookingData.doctor?.id;
        if (currentDoctorId && String(currentDoctorId) === String(doctorId)) {
            return;
        }

        const fetchDoctor = async () => {
            setIsLoadingDoctor(true);
            setDoctorLoadError(null);
            try {
                const doc = await appointmentsApi.getDoctorById(doctorId);
                if (doc) {
                    const mapEnumToBookingType = (pt) => {
                        if (pt === 'HOSPITAL') return 'Hospital';
                        if (pt === 'INDEPENDENT') return 'Independent Clinic';
                        if (pt === 'TELEMEDICINE') return 'Telemedicine';
                        return 'Telemedicine'; // Fallback
                    };

                    const bookingType = mapEnumToBookingType(doc.practice_type);

                    setAppointmentType(bookingType);
                    setBookingData({
                        appointment_type: bookingType,
                        doctor: {
                            id: doc.id,
                            user_id: doc.user_id,
                            name: doc.full_name,
                            full_name: doc.full_name,
                            specialization: doc.specialization,
                            qualification: doc.qualification,
                            consultation_fee: doc.consultation_fee,
                            practice_type: doc.practice_type
                        },
                        branch: doc.branch_id ? { id: doc.branch_id, name: doc.branch_name } : null,
                        department: doc.department_id ? { id: doc.department_id, name: doc.department_name } : null,
                        hospital: doc.organization_id ? { id: doc.organization_id, name: doc.hospital_name } : null
                    });

                    // Determine the step index for 'slot'
                    // For 'Hospital' booking: slots is index 5
                    // For others: slots is index 2
                    if (bookingType === 'Hospital') {
                        setCurrentStepIndex(5);
                    } else {
                        setCurrentStepIndex(2);
                    }
                }
            } catch (err) {
                console.error(err);
                setDoctorLoadError("Failed to load doctor information.");
            } finally {
                setIsLoadingDoctor(false);
            }
        };

        fetchDoctor();
    }, [doctorId]);

    if (isLoadingDoctor) {
        return <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Loading doctor details...</div>;
    }

    if (doctorLoadError) {
        return (
            <div className="max-w-4xl mx-auto py-8">
                <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 mb-6">
                    {doctorLoadError}
                </div>
            </div>
        );
    }

    const getSteps = () => {
        if (!appointmentType) {
            return [{ id: 'type', label: 'Booking Type' }];
        }
        if (appointmentType === 'Hospital') {
            return [
                { id: 'type', label: 'Booking Type' },
                { id: 'hospital', label: 'Hospital' },
                { id: 'branch', label: 'Branch' },
                { id: 'department', label: 'Department' },
                { id: 'doctor', label: 'Doctor' },
                { id: 'date', label: 'Date' },
                { id: 'slot', label: 'Slot' },
                { id: 'review', label: 'Review' },
                { id: 'confirmation', label: 'Confirmation' }
            ];
        } else {
            return [
                { id: 'type', label: 'Booking Type' },
                { id: 'doctor', label: 'Doctor' },
                { id: 'date', label: 'Date' },
                { id: 'slot', label: 'Slot' },
                { id: 'review', label: 'Review' },
                { id: 'confirmation', label: 'Confirmation' }
            ];
        }
    };

    const steps = getSteps();

    const handleTypeSelect = (type) => {
        setAppointmentType(type);
        setBookingData({ appointment_type: type });
        setCurrentStepIndex(1);
    };

    const nextStep = (data) => {
        setBookingData(prev => {
            const nextData = data ? { ...prev, ...data } : { ...prev };
            
            // If a new hospital is selected, clear downstream state
            if (data && data.hospital && prev.hospital?.id !== data.hospital.id) {
                nextData.branch = null;
                nextData.department = null;
                nextData.doctor = null;
                nextData.date = null;
                nextData.slot = null;
            }
            // If a new branch is selected, clear downstream state
            if (data && data.branch && prev.branch?.id !== data.branch.id) {
                nextData.department = null;
                nextData.doctor = null;
                nextData.date = null;
                nextData.slot = null;
            }
            // If a new department is selected, clear downstream state
            if (data && data.department && prev.department?.id !== data.department.id) {
                nextData.doctor = null;
                nextData.date = null;
                nextData.slot = null;
            }
            // If a new doctor is selected, clear downstream state
            if (data && data.doctor && prev.doctor?.id !== data.doctor.id) {
                nextData.date = null;
                nextData.slot = null;
            }
            // If a new date is selected, clear slot
            if (data && data.date && prev.date !== data.date) {
                nextData.slot = null;
            }
            
            return nextData;
        });
        setCurrentStepIndex(prev => prev + 1);
    };

    const prevStep = () => {
        if (currentStepIndex === 1) {
            setAppointmentType(null);
            setBookingData({});
            setCurrentStepIndex(0);
        } else {
            const currentStepId = steps[currentStepIndex].id;
            if (currentStepId === 'department' && bookingData.branch?.is_default) {
                setCurrentStepIndex(prev => Math.max(0, prev - 2));
            } else {
                setCurrentStepIndex(prev => Math.max(0, prev - 1));
            }
        }
    };

    const goToStep = (index) => {
        if (index >= currentStepIndex) return;
        if (index === 0) {
            setAppointmentType(null);
            setBookingData({});
        }
        setCurrentStepIndex(index);
    };

    const renderStep = () => {
        const stepId = steps[currentStepIndex].id;
        switch (stepId) {
            case 'type': return <TypeSelect onSelect={handleTypeSelect} />;
            case 'hospital': return <HospitalSearch onNext={nextStep} />;
            case 'branch': return <BranchSelect data={bookingData} onNext={nextStep} onBack={prevStep} />;
            case 'department': return <DepartmentSelect data={bookingData} onNext={nextStep} onBack={prevStep} />;
            case 'doctor': return <DoctorSelect data={bookingData} onNext={nextStep} onBack={prevStep} />;
            case 'date': return <DateSelect data={bookingData} onNext={nextStep} onBack={prevStep} />;
            case 'slot': return <SlotSelect data={bookingData} onNext={nextStep} onBack={prevStep} />;
            case 'review': return <ReviewAppointment data={bookingData} onNext={nextStep} onBack={prevStep} />;
            case 'confirmation': return <BookingSuccess data={bookingData} />;
            default: return <div>Unknown Step</div>;
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Step Indicator */}
            {currentStepIndex < steps.length - 1 && (
                <div className="flex items-center justify-between mb-8 pb-8 border-b overflow-x-auto px-4">
                    {steps.slice(0, steps.length - 1).map((step, index) => (
                        <div key={step.id} onClick={() => goToStep(index)} className={`flex flex-col items-center flex-1 relative min-w-[80px] ${currentStepIndex > index ? 'cursor-pointer hover:opacity-80' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm z-10 transition-colors ${
                                currentStepIndex > index ? 'bg-teal-500 text-white' :
                                currentStepIndex === index ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                            }`}>
                                {currentStepIndex > index ? '✓' : index + 1}
                            </div>
                            <span className={`text-xs mt-2 font-medium ${currentStepIndex === index ? 'text-blue-600' : 'text-gray-500'}`}>
                                {step.label}
                            </span>
                            {index < steps.length - 2 && (
                                <div className={`absolute top-4 left-1/2 w-full h-0.5 -z-10 ${
                                    currentStepIndex > index ? 'bg-teal-500' : 'bg-gray-100'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-2">
                {renderStep()}
            </div>
        </div>
    );
};

export default AppointmentWizard;
