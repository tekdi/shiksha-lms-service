export interface ApiResponseParams {
  resmsgid: string;
  status: 'successful' | 'failed';
  err?: string | null;
  errmsg?: string | null;
}

export interface ApiResponse<T = any> {
  id: string;
  ver: string;
  ts: string;
  params: ApiResponseParams;
  responseCode: number;
  result?: T;
}