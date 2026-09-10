import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function InviteQRCode({ url, label = 'Scan to join this party' }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url || !canvasRef.current) return;
    setFailed(false);
    QRCode.toCanvas(canvasRef.current, url, {
      width: 132,
      margin: 1,
      color: { dark: '#10221d', light: '#f2e7c9' },
      errorCorrectionLevel: 'M',
    }).catch(() => setFailed(true));
  }, [url]);
  if (!url || failed) return null;
  return <canvas ref={canvasRef} role="img" aria-label={label} className="h-[132px] w-[132px] rounded border border-blueprint/30 bg-[#f2e7c9] p-1" />;
}
