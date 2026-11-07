/**
 * Microsoft Dynamics 365 Web Resource Adapter
 * Provides bridge between Freedom Broker CQA and Dynamics 365 CRM
 */

window.D365Adapter = (function() {
    let context = {
        isEmbeddedInD365: false,
        entityId: null,
        entityName: null,
        userRoles: []
    };

    function init() {
        // Detect if parent window has Xrm context
        try {
            if (window.parent && window.parent.Xrm) {
                context.isEmbeddedInD365 = true;
                const clientUrl = window.parent.Xrm.Utility.getGlobalContext().getClientUrl();
                console.log("[D365 Adapter] Embedded in Dynamics 365 instance:", clientUrl);
                
                // Get active form record if available
                if (window.parent.Xrm.Page && window.parent.Xrm.Page.data && window.parent.Xrm.Page.data.entity) {
                    context.entityId = window.parent.Xrm.Page.data.entity.getId();
                    context.entityName = window.parent.Xrm.Page.data.entity.getEntityName();
                    console.log(`[D365 Adapter] Active Record: ${context.entityName} (${context.entityId})`);
                }
            }
        } catch (e) {
            // Standalone mode or cross-origin iframe
            context.isEmbeddedInD365 = false;
        }

        // Listen for postMessage from D365 host
        window.addEventListener("message", handleHostMessage);
    }

    function handleHostMessage(event) {
        if (!event.data || typeof event.data !== "object") return;
        const msg = event.data;
        
        if (msg.type === "D365_SELECT_CONVERSATION") {
            if (msg.conversationId && typeof window.loadDialogue === "function") {
                window.loadDialogue(msg.conversationId);
            }
        }
    }

    function notifyScoreUpdated(conversationId, score, severeViolation) {
        if (!context.isEmbeddedInD365) return;
        try {
            if (window.parent) {
                window.parent.postMessage({
                    type: "CQA_EVALUATION_COMPLETED",
                    conversationId: conversationId,
                    score: score,
                    severeViolation: severeViolation
                }, "*");
            }
        } catch (e) {
            console.error("[D365 Adapter] Failed to post message to parent:", e);
        }
    }

    return {
        init: init,
        getContext: () => context,
        notifyScoreUpdated: notifyScoreUpdated
    };
})();

document.addEventListener("DOMContentLoaded", () => {
    window.D365Adapter.init();
});
