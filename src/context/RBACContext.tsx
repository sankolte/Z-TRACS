import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, User } from '../types';
import { INITIAL_USERS } from '../data/mockData';

export interface RolePermissions {
  role: UserRole;
  label: string;
  description: string;
  canCreateCamera: boolean;
  canEditCamera: boolean;
  canArchiveCamera: boolean;
  canRestoreCamera: boolean;
  canMarkMaintenance: boolean;
  canBulkImport: boolean;
  canViewReports: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canViewAuditLogs: boolean;
  districtScoped: boolean;
  departmentScoped: boolean;
}

export const ROLE_PERMISSIONS_MAP: Record<UserRole, RolePermissions> = {
  STATE_ADMIN: {
    role: 'STATE_ADMIN',
    label: 'State Administrator',
    description: 'Full statewide governance access across all departments, districts, and system settings.',
    canCreateCamera: true,
    canEditCamera: true,
    canArchiveCamera: true,
    canRestoreCamera: true,
    canMarkMaintenance: true,
    canBulkImport: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: true,
    canManageRoles: true,
    canViewAuditLogs: true,
    districtScoped: false,
    departmentScoped: false,
  },
  DISTRICT_ADMIN: {
    role: 'DISTRICT_ADMIN',
    label: 'District Administrator',
    description: 'Administrative control restricted to assigned district cameras, onboarding, and gap analysis.',
    canCreateCamera: true,
    canEditCamera: true,
    canArchiveCamera: true,
    canRestoreCamera: true,
    canMarkMaintenance: true,
    canBulkImport: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageRoles: false,
    canViewAuditLogs: true,
    districtScoped: true,
    departmentScoped: false,
  },
  DEPARTMENT_ADMIN: {
    role: 'DEPARTMENT_ADMIN',
    label: 'Department Administrator',
    description: 'Administrative control restricted to assigned department cameras, onboarding, and users.',
    canCreateCamera: true,
    canEditCamera: true,
    canArchiveCamera: true,
    canRestoreCamera: true,
    canMarkMaintenance: true,
    canBulkImport: true,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageRoles: false,
    canViewAuditLogs: true,
    districtScoped: false,
    departmentScoped: true,
  },
  DISTRICT_OFFICER: {
    role: 'DISTRICT_OFFICER',
    label: 'District Officer',
    description: 'Jurisdictional access scoped strictly to assigned district infrastructure and gap reporting.',
    canCreateCamera: true,
    canEditCamera: true,
    canArchiveCamera: false,
    canRestoreCamera: false,
    canMarkMaintenance: true,
    canBulkImport: false,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageRoles: false,
    canViewAuditLogs: true,
    districtScoped: true,
    departmentScoped: false,
  },
  CONTROL_ROOM_OPERATOR: {
    role: 'CONTROL_ROOM_OPERATOR',
    label: 'Control Room Operator',
    description: 'Operational health monitoring, multi-camera video wall, and alert management.',
    canCreateCamera: false,
    canEditCamera: false,
    canArchiveCamera: false,
    canRestoreCamera: false,
    canMarkMaintenance: true,
    canBulkImport: false,
    canViewReports: true,
    canExportReports: false,
    canManageUsers: false,
    canManageRoles: false,
    canViewAuditLogs: false,
    districtScoped: false,
    departmentScoped: false,
  },
  POLICE_OFFICER: {
    role: 'POLICE_OFFICER',
    label: 'Police Field Officer',
    description: 'ANPR vehicle search, cross-camera journey tracking, and SHA-256 evidence vault.',
    canCreateCamera: false,
    canEditCamera: false,
    canArchiveCamera: false,
    canRestoreCamera: false,
    canMarkMaintenance: true,
    canBulkImport: false,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageRoles: false,
    canViewAuditLogs: true,
    districtScoped: false,
    departmentScoped: false,
  },
  STATE_AUDITOR: {
    role: 'STATE_AUDITOR',
    label: 'State Auditor',
    description: 'Read-only compliance access for auditing, integrity verification, and report generation.',
    canCreateCamera: false,
    canEditCamera: false,
    canArchiveCamera: false,
    canRestoreCamera: false,
    canMarkMaintenance: false,
    canBulkImport: false,
    canViewReports: true,
    canExportReports: true,
    canManageUsers: false,
    canManageRoles: false,
    canViewAuditLogs: true,
    districtScoped: false,
    departmentScoped: false,
  },
};

interface RBACContextType {
  currentUser: User;
  currentRole: UserRole;
  permissions: RolePermissions;
  switchRole: (role: UserRole) => void;
  switchUser: (user: User) => void;
  can: (action: keyof RolePermissions) => boolean;
  isResourceAllowed: (district?: string, departmentId?: string) => boolean;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

export const RBACProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Restore logged-in user from localStorage on refresh
  const getInitialUser = (): User => {
    try {
      const saved = localStorage.getItem('ztracs_user');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_USERS[0];
  };

  const [currentUser, setCurrentUser] = useState<User>(getInitialUser);
  const [currentRole, setCurrentRole] = useState<UserRole>(getInitialUser().role);

  const permissions = ROLE_PERMISSIONS_MAP[currentRole] || ROLE_PERMISSIONS_MAP.STATE_ADMIN;

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
    const matchedUser = INITIAL_USERS.find(u => u.role === role);
    const newUser = matchedUser || { ...currentUser, role };
    setCurrentUser(newUser);
    try { localStorage.setItem('ztracs_user', JSON.stringify(newUser)); } catch (_) {}
  };

  const switchUser = (user: User) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    try { localStorage.setItem('ztracs_user', JSON.stringify(user)); } catch (_) {}
  };

  const can = (action: keyof RolePermissions): boolean => {
    const val = permissions[action];
    return typeof val === 'boolean' ? val : false;
  };

  const isResourceAllowed = (district?: string, departmentId?: string): boolean => {
    if (currentRole === 'STATE_ADMIN' || currentRole === 'STATE_AUDITOR' || currentRole === 'CONTROL_ROOM_OPERATOR' || currentRole === 'POLICE_OFFICER') {
      return true;
    }
    if (permissions.districtScoped && district && currentUser.district) {
      return district.toLowerCase() === currentUser.district.toLowerCase();
    }
    if (permissions.departmentScoped && departmentId && currentUser.departmentId) {
      return departmentId === currentUser.departmentId;
    }
    return true;
  };

  return (
    <RBACContext.Provider value={{
      currentUser,
      currentRole,
      permissions,
      switchRole,
      switchUser,
      can,
      isResourceAllowed,
    }}>
      {children}
    </RBACContext.Provider>
  );
};

export const useRBAC = (): RBACContextType => {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
};
