import crypto from "node:crypto";
import pool from "../config/db.js";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

const normalizePositiveInteger = (value) => {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const normalizeHistoryLimit = (value) =>
    Math.min(normalizePositiveInteger(value) ?? DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);

const normalizeCropTypeFilter = (value) =>
    typeof value === "string" && value.trim() !== ""
        ? value.trim().toLowerCase()
        : null;

const normalizeCropType = (crop = {}) => {
    if (!crop || typeof crop !== "object") {
        return null;
    }

    const cropType = crop.type ?? crop.crop_type ?? crop.cropType ?? null;
    return typeof cropType === "string" && cropType.trim() !== ""
        ? cropType.trim().toLowerCase()
        : null;
};

const normalizeObject = (value, fallback = {}) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : fallback;

const normalizeArray = (value) =>
    Array.isArray(value) ? value : [];

const normalizeOptionalInteger = (value) => {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) ? parsedValue : null;
};

const normalizeOptionalId = (value) => {
    if (typeof value === "string" && value.trim() !== "") {
        return value.trim();
    }

    return normalizeOptionalInteger(value);
};

const buildRequestContext = ({
    requestedDays,
    irrigation,
    calibration
}) => ({
    requestedDays: normalizePositiveInteger(requestedDays),
    irrigation: normalizeObject(irrigation, null),
    calibration: normalizeObject(calibration, null)
});

export const persistCropIntelligenceHistory = async ({
    userId,
    profile,
    weatherData,
    crops = [],
    insights = [],
    requestedDays,
    irrigation = null,
    calibration = null
}) => {
    if (!userId || !Array.isArray(insights) || insights.length === 0) {
        return [];
    }

    const runGroupId = crypto.randomUUID();
    const requestContext = buildRequestContext({
        requestedDays,
        irrigation,
        calibration
    });
    const historyRows = [];

    for (const [index, insight] of insights.entries()) {
        const cropInput = normalizeObject(crops[index], {});
        const resultSnapshot = normalizeObject(insight, {});
        const queryResult = await pool.query(
            `INSERT INTO crop_intelligence_history (
                run_group_id,
                user_id,
                crop_id,
                farm_id,
                crop_type,
                stage,
                stage_source,
                county,
                subcounty,
                risk_score,
                confidence_score,
                model_version,
                drivers,
                risks,
                recommendations,
                crop_input,
                request_context,
                weather_snapshot,
                result_snapshot
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            RETURNING id, run_group_id, crop_type, created_at`,
            [
                runGroupId,
                userId,
                normalizeOptionalId(cropInput.id ?? cropInput.crop_id),
                normalizeOptionalId(cropInput.farmId ?? cropInput.farm_id),
                insight?.crop ?? normalizeCropType(cropInput) ?? "unknown",
                insight?.stage ?? null,
                insight?.stageSource ?? null,
                profile?.county ?? null,
                profile?.subcounty ?? null,
                normalizeOptionalInteger(insight?.riskScore),
                normalizeOptionalInteger(insight?.confidenceScore),
                insight?.riskDetail?.modelVersion ?? null,
                normalizeArray(insight?.drivers),
                normalizeArray(insight?.risks),
                normalizeArray(insight?.recommendations),
                cropInput,
                requestContext,
                normalizeObject(weatherData, {}),
                resultSnapshot
            ]
        );

        if (queryResult.rows[0]) {
            historyRows.push(queryResult.rows[0]);
        }
    }

    return historyRows;
};

export const getCropIntelligenceHistoryEntries = async ({
    userId,
    limit,
    cropType
}) => {
    const normalizedLimit = normalizeHistoryLimit(limit);
    const normalizedCropType = normalizeCropTypeFilter(cropType);
    const result = await pool.query(
        `SELECT
            id,
            run_group_id,
            user_id,
            crop_id,
            farm_id,
            crop_type,
            stage,
            stage_source,
            county,
            subcounty,
            risk_score,
            confidence_score,
            model_version,
            drivers,
            risks,
            recommendations,
            crop_input,
            request_context,
            weather_snapshot,
            result_snapshot,
            created_at
        FROM crop_intelligence_history
        WHERE user_id = $1
          AND ($2::text IS NULL OR LOWER(crop_type) = $2)
        ORDER BY created_at DESC, id DESC
        LIMIT $3`,
        [userId, normalizedCropType, normalizedLimit]
    );

    return {
        entries: result.rows,
        filters: {
            limit: normalizedLimit,
            cropType: normalizedCropType
        }
    };
};
