import type { LoginReqDto, LoginResDto, RegisterReqDto, VerifyEmailReqDto } from '../dto/auth'
import type { ApiResponse } from '../dto/response/api-response'
import { requestData, requestResponse } from './apiService'

export const authService = {
  login(dto: LoginReqDto): Promise<ApiResponse<LoginResDto>> {
    return requestResponse<LoginResDto>('/auth/login', 'POST', dto)
  },

  register(dto: RegisterReqDto): Promise<unknown> {
    return requestData('/auth/register', 'POST', dto)
  },

  verifyEmail(dto: VerifyEmailReqDto): Promise<unknown> {
    return requestData('/auth/verify-email', 'POST', dto)
  },
}
