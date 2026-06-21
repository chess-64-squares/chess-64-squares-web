import type { UserResDto } from '../dto/user'
import { requestData } from './apiService'

export const userService = {
  getProfile(token?: string | null): Promise<UserResDto> {
    return requestData<UserResDto>('/user/profile', 'GET', undefined, token)
  },
}
