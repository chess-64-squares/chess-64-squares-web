import { ApiResponse } from "../dto/response/api-response";
export const TOKEN_STORAGE_KEY = "chess64.token";
export const API_BASE_URL = (import.meta.env.VITE_SERVER_URL || "http://localhost:8000/api/v1") as string;
export const SOCKET_URL = buildSocketUrl((import.meta.env.VITE_SOCKET_URL || API_BASE_URL) as string);

function buildSocketUrl(value: string) {
    const withoutApiPrefix = value.replace(/\/api\/v\d+\/?$/i, "");
    return withoutApiPrefix.endsWith("/game") ? withoutApiPrefix : `${withoutApiPrefix.replace(/\/$/, "")}/game`;
}

export class Connect {
    static async request<T>(
        endpoint: string,
        method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
        body?: any,
        token?: string | null
    ): Promise<ApiResponse<T>> {
        try {
            const accessToken = token ?? localStorage.getItem(TOKEN_STORAGE_KEY);
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
