function SecureFileViewer({ file, onClose }) {
  if (!file) return null;

  const isPdf =
    file.mimeType === "application/pdf" ||
    file.filename.toLowerCase().endsWith(".pdf");
  const isImage = file.mimeType.startsWith("image/");

  return (
    <div className="med-modal-backdrop" role="dialog" aria-modal="true">
      <div className="med-viewer">
        <div className="flex flex-col gap-3 border-b border-cyan-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="break-words font-semibold med-title">{file.filename}</p>
            <p className="text-sm med-muted">Secure medical file viewer</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <a href={file.url} download={file.filename} className="med-button-secondary text-center">
              Download
            </a>
            <button type="button" onClick={onClose} className="med-button-danger">
              Close
            </button>
          </div>
        </div>

        <div className="med-viewer-body">
          {isPdf ? (
            <iframe
              title={file.filename}
              src={file.url}
              className="h-full min-h-[70vh] w-full"
            />
          ) : null}
          {isImage ? (
            <img
              src={file.url}
              alt={file.filename}
              className="mx-auto max-h-[76vh] max-w-full rounded-xl object-contain"
            />
          ) : null}
          {!isPdf && !isImage ? (
            <div className="med-alert med-alert-info">
              Preview is not available for this file type. Use Download to open it.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SecureFileViewer;
