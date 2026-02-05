/**
 * Skill Handlers Registry
 * TASK: AI Agent Skills Tab - Phase 1
 *
 * Import this file to register all available skill handlers.
 * Each handler file calls registerSkill() on import.
 */

// Built-in skills (no integration required)
import "./order-lookup";
import "./helpdesk";
import "./human-handoff";

// Integration-based skills would be added here as they're implemented:
// import "./woocommerce";
// import "./cin7";
// import "./klaviyo";

export { default as orderLookupHandler } from "./order-lookup";
export { default as helpdeskHandler } from "./helpdesk";
export { default as humanHandoffHandler } from "./human-handoff";
