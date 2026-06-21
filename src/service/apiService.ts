import { Connect } from '../connect/connect'
import type { ApiResponse } from '../dto/response/api-response'

export async function requestData<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const response = await Connect.request<T>(endpoint, method, body, token)
  if (!response.success) {
    throw new Error(response.message || 'Request failed')
  }

  return response.data as T
}

export async function requestResponse<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: unknown,
  token?: string | null,
): Promise<ApiResponse<T>> {
  return Connect.request<T>(endpoint, method, body, token)
}
