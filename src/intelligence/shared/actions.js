export const ACTION_PRIORITY_SCORES = {
    immediate: 90,
    soon: 70,
    monitor: 45,
    routine: 25
};

const sortActions = (actions = []) =>
    [...actions].sort((left, right) => right.score - left.score || left.message.localeCompare(right.message));

const buildFallbackKey = (message, category) =>
    `${category}:${message.trim().toLowerCase()}`;

export const createActionCollector = () => {
    const actions = [];

    const add = (
        message,
        {
            key = null,
            why = null,
            priority = "monitor",
            category = "general",
            timing = "this week",
            score = ACTION_PRIORITY_SCORES[priority] ?? ACTION_PRIORITY_SCORES.monitor
        } = {}
    ) => {
        const cleanedMessage = typeof message === "string" ? message.trim() : "";

        if (!cleanedMessage) {
            return;
        }

        const normalizedKey = typeof key === "string" && key.trim() !== ""
            ? key.trim()
            : buildFallbackKey(cleanedMessage, category);
        const nextAction = {
            key: normalizedKey,
            message: cleanedMessage,
            why,
            priority,
            category,
            timing,
            score
        };
        const existingAction = actions.find((action) => action.key === normalizedKey);

        if (!existingAction) {
            actions.push(nextAction);
            return;
        }

        if (nextAction.score > existingAction.score) {
            Object.assign(existingAction, nextAction);
        }
    };

    const merge = (entries = []) => {
        entries.forEach((entry) => {
            add(entry.message, entry);
        });
    };

    const draft = () => sortActions(actions);

    const finalize = () =>
        draft().map(({ key: actionKey, score, ...action }) => action);

    return {
        add,
        merge,
        draft,
        finalize
    };
};
