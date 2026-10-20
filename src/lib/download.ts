const safe = (t: string) => t.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);

export async function downloadDocx(title: string, content: string) {
  const [{ saveAs }, { Document, Packer, Paragraph }] = await Promise.all([import("file-saver"), import("docx")]);
  const doc = new Document({
    sections: [{ children: content.split("\n").map((line) => new Paragraph({ text: line })) }],
  });
  saveAs(await Packer.toBlob(doc), `${safe(title)}.docx`);
}

export async function downloadPdf(title: string, content: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  const margin = 56;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const lines = pdf.splitTextToSize(content, pdf.internal.pageSize.getWidth() - margin * 2) as string[];
  let y = margin;
  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += 16;
  }
  pdf.save(`${safe(title)}.pdf`);
}
