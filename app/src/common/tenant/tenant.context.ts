import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private currentTenantId: string;

  setTenantId(tenantId: string) {
    this.currentTenantId = tenantId;
  }

  getTenantId(): string | undefined {
    return this.currentTenantId;
  }
} 