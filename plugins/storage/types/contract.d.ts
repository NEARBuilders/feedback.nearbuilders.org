import "@orpc/openapi/extensions/route";
import { z } from "zod";
export declare const AssetSchema: z.ZodObject<{
    id: z.ZodString;
    key: z.ZodString;
    publicUrl: z.ZodString;
    uploaderAccountId: z.ZodString;
    filename: z.ZodString;
    contentType: z.ZodString;
    sizeBytes: z.ZodNumber;
    ownerId: z.ZodNullable<z.ZodString>;
    status: z.ZodString;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type Asset = z.infer<typeof AssetSchema>;
export declare const contract: {
    ping: import("@orpc/contract").ProcedureContract<import("@orpc/contract").InitialInputSchema, z.ZodObject<{
        provider: z.ZodString;
        status: z.ZodLiteral<"ok">;
        configured: z.ZodBoolean;
        timestamp: z.ZodString;
    }, z.core.$strip>, object>;
    requestUpload: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        filename: z.ZodString;
        contentType: z.ZodString;
        sizeBytes: z.ZodNumber;
    }, z.core.$strip>, z.ZodObject<{
        presignedUrl: z.ZodString;
        assetId: z.ZodString;
        publicUrl: z.ZodString;
        key: z.ZodString;
    }, z.core.$strip>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    confirmUpload: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        publicUrl: z.ZodString;
        uploaderAccountId: z.ZodString;
        filename: z.ZodString;
        contentType: z.ZodString;
        sizeBytes: z.ZodNumber;
        ownerId: z.ZodNullable<z.ZodString>;
        status: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        BAD_REQUEST: {
            readonly status: 400;
            readonly data: z.ZodObject<{
                invalidFields: z.ZodOptional<z.ZodArray<z.ZodString>>;
                validationErrors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    message: z.ZodString;
                    code: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    attachAsset: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        key: z.ZodString;
        ownerId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        key: z.ZodString;
        publicUrl: z.ZodString;
        uploaderAccountId: z.ZodString;
        filename: z.ZodString;
        contentType: z.ZodString;
        sizeBytes: z.ZodNumber;
        ownerId: z.ZodNullable<z.ZodString>;
        status: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    attachByUrls: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        ownerId: z.ZodString;
        urls: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        attached: z.ZodNumber;
    }, z.core.$strip>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    deleteByOwner: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        ownerId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        deleted: z.ZodNumber;
    }, z.core.$strip>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
    deleteFile: import("@orpc/contract").ProcedureContract<z.ZodObject<{
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodBoolean;
    }, z.core.$strip>, {
        UNAUTHORIZED: {
            readonly status: 401;
            readonly data: z.ZodObject<{
                apiKeyProvided: z.ZodBoolean;
                provider: z.ZodOptional<z.ZodString>;
                authType: z.ZodOptional<z.ZodEnum<{
                    apiKey: "apiKey";
                    oauth: "oauth";
                    token: "token";
                }>>;
            }, z.core.$strip>;
        };
        FORBIDDEN: {
            readonly status: 403;
            readonly data: z.ZodObject<{
                requiredPermissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
                action: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        NOT_FOUND: {
            readonly status: 404;
            readonly data: z.ZodObject<{
                resource: z.ZodOptional<z.ZodString>;
                resourceId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
        SERVICE_UNAVAILABLE: {
            readonly status: 503;
            readonly data: z.ZodObject<{
                retryAfter: z.ZodOptional<z.ZodNumber>;
                maintenanceWindow: z.ZodDefault<z.ZodBoolean>;
                estimatedUptime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        };
    }>;
};
export type ContractType = typeof contract;
