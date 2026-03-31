"use client";

export function CameraModal() {
  return (
    <section className="panel">
      <div className="panelTitle">Kvittering og OCR</div>
      <p className="mutedText">
        OCR-kallet er flyttet til <code>/api/ocr</code> slik at Anthropic-nøkkelen ikke lenger
        ligger i klienten.
      </p>
    </section>
  );
}
