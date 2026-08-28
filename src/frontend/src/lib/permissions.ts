import { ApprovalEntity, AppRole, FeatureAccessLevel } from "@/types/settings";

// Mirror of api/common/features.py ACCESS_LEVEL_ORDER
export const ACCESS_LEVEL_ORDER: Record<FeatureAccessLevel, number> = {
    [FeatureAccessLevel.NONE]: 0,
    [FeatureAccessLevel.READ_ONLY]: 1,
    [FeatureAccessLevel.FILTERED]: 2,
    [FeatureAccessLevel.READ_WRITE]: 3,
    [FeatureAccessLevel.FULL]: 4,
    [FeatureAccessLevel.ADMIN]: 5,
};

/** Mirrors backend ApprovalChecker: union of approval_privileges across matching roles (or applied role override). */
export function userHasApprovalPrivilege(
    entity: ApprovalEntity,
    userGroups: string[] | null | undefined,
    availableRoles: AppRole[],
    appliedRoleId: string | null
): boolean {
    const norm = (g: string) => g.toLowerCase();
    const userGroupSet = new Set((userGroups || []).map(norm));
    if (appliedRoleId) {
        const role = availableRoles.find((r) => r.id === appliedRoleId);
        return Boolean(role?.approval_privileges?.[entity]);
    }
    for (const role of availableRoles) {
        const roleGroups = new Set((role.assigned_groups || []).map(norm));
        const intersects = [...roleGroups].some((g) => userGroupSet.has(g));
        if (intersects && role.approval_privileges?.[entity]) {
            return true;
        }
    }
    return false;
} 