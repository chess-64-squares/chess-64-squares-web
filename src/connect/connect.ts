import { ApiResponse } from "../dto/response/api-response";
export const TOKEN_STORAGE_KEY = "chess64.token";
const server_url = (import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1") as string;

export class Connect {
    static async request<T>(
        endpoint: string,
        method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
        body?: any,
        token?: string | null
    ): Promise<ApiResponse<T>> {
        try {
            const accessToken = token ?? localStorage.getItem(TOKEN_STORAGE_KEY);
            const response = await fetch(`${server_url}${endpoint}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (response.status === 401) {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
                window.location.href = "/login";
            }

            const responseData = await response.json().catch(() => ({}));
            // console.log(method + " - " + endpoint +  " - " + JSON.stringify(body, null, 2) +  " - Response data" + JSON.stringify({responseData}, null, 2) );
            return responseData as ApiResponse<T>;
        } catch {
            return {
                success: false,
                message: "Error connect",
                data: null,
                errorCode: "99001",
                timeStamp: new Date().toISOString()
            } as ApiResponse<T>;
        }
    }
}
