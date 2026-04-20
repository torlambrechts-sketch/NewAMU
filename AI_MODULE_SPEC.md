# AI module specification

This repository’s authoritative module patterns live in **`MODULE_SPEC.md`**.

When building or refactoring modules (including ROS), follow **`MODULE_SPEC.md`** for:

- Database-first migrations, RLS, `organization_id`, soft deletes  
- One hook per module, Zod validation on fetch, central error handling  
- Admin pages (`ModuleAdminShell`), workflow integration (`WorkflowRulesTab`)  
- UI primitives from `src/components/ui/`  

For ROS-specific requirements in this codebase, see the implementation under `modules/ros/` and `src/pages/RosModuleAdminPage.tsx`.
