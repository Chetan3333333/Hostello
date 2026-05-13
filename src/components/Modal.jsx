import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;
  
  const sizes = { sm: '440px', md: '560px', lg: '720px', xl: '900px' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container animate-scale"
        style={{ maxWidth: sizes[size] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
