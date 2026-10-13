export class RenderCertificateDTO {
  credentialId: string;
  templateId: string;

  constructor(credentialId: string, templateId: string) {
    this.credentialId = credentialId;
    this.templateId = templateId;
  }
}
