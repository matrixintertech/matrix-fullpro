export async function generatePdfStub() {
  return {
    success: false,
    code: "PDF_STUBBED",
    message:
      "Puppeteer PDF generation is disabled for this phase and will be enabled on VPS deployment.",
  };
}
