import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Server, 
  Key, 
  Activity, 
  FileSpreadsheet, 
  Lock, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Database,
  Layers,
  Cpu,
  Download,
  RefreshCw,
  Edit,
  UserX,
  UserCheck,
  Shield,
  Phone,
  Mail,
  Building2,
  MapPin,
  X,
  Eye,
  EyeOff
}
from 'lucide-react';
import { User, VmsReference, SubsystemStatus, UserRole, Department, District } from '../types';
import { INITIAL_USERS, INITIAL_VMS_REFERENCES, INITIAL_SUBSYSTEMS, INITIAL_DEPARTMENTS, INITIAL_DISTRICTS } from '../data/mockData';
import { ROLE_PERMISSIONS_MAP } from '../context/RBACContext';

interface AdministrationViewProps {
  departments?: Department[];
  districts?: District[];
  onAddUser?: (user: User) => void;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  departments = INITIAL_DEPARTMENTS,
  districts = INITIAL_DISTRICTS,
  onAddUser,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'users' | 'roles' | 'vms' | 'system' | 'api' | 'templates'>('users');
  const [usersList, setUsersList] = useState<User[]>(INITIAL_USERS);
  const [vmsList, setVmsList] = useState<VmsReference[]>(INITIAL_VMS_REFERENCES);
  const [subsystems, setSubsystems] = useState<SubsystemStatus[]>(INITIAL_SUBSYSTEMS);

  // User Filter State
  const [userSearch, setUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modal State for Provisioning & Editing Users
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // New User Form State
  const [formData, setFormData] = useState({
    name: '',
    badge: '',
    email: '',
    mobile: '',
    passphrase: '',
    role: 'CONTROL_ROOM_OPERATOR' as UserRole,
    departmentId: 'DEPT-POL-01',
    district: 'Statewide (All)',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    allowedModules: ['overview', 'cctv-gis', 'sentinel-live-wall', 'anpr-search'],
  });

  const availableModules = [
    { id: 'overview', name: 'Overview Dashboard' },
    { id: 'cctv-gis', name: 'CCTV GIS Spatial Map' },
    { id: 'registry', name: 'Camera Registry & Onboarding' },
    { id: 'sentinel-live-wall', name: 'Sentinel Live 31 Video Wall' },
    { id: 'anpr-search', name: 'ANPR Vehicle Search Engine' },
    { id: 'vehicle-journey', name: '3D Vehicle Journey Tracker' },
    { id: 'gap-analysis', name: 'Gap Analysis DPR' },
    { id: 'reports', name: 'Official Reports Generator' },
    { id: 'audit-logs', name: 'Immutable Audit Ledger' },
    { id: 'administration', name: 'System Administration & RBAC' },
  ];

  // Filtered users calculation
  const filteredUsers = usersList.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.badge.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.district || '').toLowerCase().includes(userSearch.toLowerCase());
    
    const matchRole = selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;
    const matchDept = selectedDeptFilter === 'ALL' || u.departmentId === selectedDeptFilter;
    const matchStatus = selectedStatusFilter === 'ALL' || u.status === selectedStatusFilter;

    return matchSearch && matchRole && matchDept && matchStatus;
  });

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.badge || !formData.email) return;

    const selectedDeptObj = departments.find(d => d.id === formData.departmentId);

    const newUser: User = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: formData.name,
      badge: formData.badge,
      email: formData.email,
      mobile: formData.mobile || '+91 98250 00000',
      passphrase: formData.passphrase || 'Pass@123',
      role: formData.role,
      departmentId: formData.departmentId,
      departmentName: selectedDeptObj?.name || 'Gujarat Police',
      district: formData.district === 'Statewide (All)' ? undefined : formData.district,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      status: formData.status,
      lastLogin: 'Never (Newly Created)',
      allowedModules: formData.allowedModules,
    };

    if (editingUser) {
      setUsersList(prev => prev.map(u => u.id === editingUser.id ? { ...newUser, id: u.id } : u));
    } else {
      setUsersList(prev => [newUser, ...prev]);
      if (onAddUser) onAddUser(newUser);
    }

    setIsAddUserModalOpen(false);
    setEditingUser(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      badge: '',
      email: '',
      mobile: '',
      passphrase: '',
      role: 'CONTROL_ROOM_OPERATOR',
      departmentId: 'DEPT-POL-01',
      district: 'Statewide (All)',
      status: 'ACTIVE',
      allowedModules: ['overview', 'cctv-gis', 'sentinel-live-wall', 'anpr-search'],
    });
  };

  const handleEditClick = (u: User) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      badge: u.badge,
      email: u.email,
      mobile: u.mobile || '',
      passphrase: u.passphrase || 'Pass@123',
      role: u.role,
      departmentId: u.departmentId || 'DEPT-POL-01',
      district: u.district || 'Statewide (All)',
      status: u.status,
      allowedModules: u.allowedModules || ['overview', 'cctv-gis', 'sentinel-live-wall'],
    });
    setIsAddUserModalOpen(true);
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsersList(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const handleExportUserRoster = () => {
    const headers = ['User ID', 'Badge ID', 'Full Name', 'Email', 'Role', 'Department', 'District Scope', 'Status', 'Last Login'];
    const rows = filteredUsers.map(u => [
      u.id,
      u.badge,
      `"${u.name}"`,
      u.email,
      u.role,
      `"${u.departmentName || ''}"`,
      u.district || 'Statewide',
      u.status,
      `"${u.lastLogin}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `z_tracs_user_directory_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleModuleSelection = (modId: string) => {
    setFormData(prev => {
      const exists = prev.allowedModules.includes(modId);
      if (exists) {
        return { ...prev, allowedModules: prev.allowedModules.filter(m => m !== modId) };
      } else {
        return { ...prev, allowedModules: [...prev.allowedModules, modId] };
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 select-none">
      
      {/* Top Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDF3FA] text-[#0052CC] border border-blue-200">
              System Administration
            </span>
            <span className="text-xs text-slate-500 font-medium">Statewide Governance & User Access Control</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">User Management & Administration Suite</h1>
        </div>

        {/* Sub-tab Pill Navigation */}
        <div className="flex items-center bg-[#EDF3FA] p-1 rounded-lg border border-slate-200 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'users', label: 'User Directory & Provisioning' },
            { id: 'roles', label: 'RBAC Matrix' },
            { id: 'vms', label: 'VMS Inventory' },
            { id: 'system', label: 'System Status' },
            { id: 'api', label: 'Registry API' },
            { id: 'templates', label: 'Import Schemas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveAdminSubTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md transition whitespace-nowrap cursor-pointer ${
                activeAdminSubTab === tab.id 
                  ? 'bg-[#0052CC] text-white shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: USER DIRECTORY & MANAGEMENT */}
      {activeAdminSubTab === 'users' && (
        <div className="space-y-4">

          {/* User Roster KPI Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Provisioned Users</span>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">{usersList.length}</div>
              <span className="text-[10px] text-emerald-600 font-bold">● Active Roster</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-[#0052CC]">State Admins (L5)</span>
              <div className="text-2xl font-black text-[#0052CC] font-mono mt-1">
                {usersList.filter(u => u.role === 'STATE_ADMIN').length}
              </div>
              <span className="text-[10px] text-slate-500">Full Statewide Access</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700">District Admins (L4)</span>
              <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                {usersList.filter(u => u.role === 'DISTRICT_ADMIN').length}
              </div>
              <span className="text-[10px] text-slate-500">District Collectors</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-700">Control Operators (L3)</span>
              <div className="text-2xl font-black text-amber-700 font-mono mt-1">
                {usersList.filter(u => u.role === 'CONTROL_ROOM_OPERATOR').length}
              </div>
              <span className="text-[10px] text-slate-500">Video Wall 24×7</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-purple-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-purple-700">Field Officers (L3)</span>
              <div className="text-2xl font-black text-purple-700 font-mono mt-1">
                {usersList.filter(u => u.role === 'POLICE_OFFICER' || u.role === 'DISTRICT_OFFICER').length}
              </div>
              <span className="text-[10px] text-slate-500">ANPR & Patrol Officers</span>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user name, badge ID, email, or district..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Role Filter */}
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
              >
                <option value="ALL">All RBAC Roles</option>
                <option value="STATE_ADMIN">State Administrator</option>
                <option value="DISTRICT_ADMIN">District Administrator</option>
                <option value="CONTROL_ROOM_OPERATOR">Control Room Operator</option>
                <option value="POLICE_OFFICER">Police Field Officer</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
              >
                <option value="ALL">All Account Statuses</option>
                <option value="ACTIVE">Active Accounts</option>
                <option value="SUSPENDED">Suspended Accounts</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportUserRoster}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition border border-slate-300 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Directory CSV</span>
              </button>

              <button
                onClick={() => { resetForm(); setEditingUser(null); setIsAddUserModalOpen(true); }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8] transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Provision User Account</span>
              </button>
            </div>

          </div>

          {/* User Accounts Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#00253e] text-white text-[11px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Official & Badge</th>
                    <th className="p-3">Contact Details</th>
                    <th className="p-3">Assigned Role</th>
                    <th className="p-3">Jurisdiction Scope</th>
                    <th className="p-3">Module Permissions</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                        No matching user accounts found in registry directory.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-[#0052CC] text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono font-bold">{u.badge}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <div className="font-mono text-slate-700 text-[11px]">{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.mobile || '+91 98250 00000'}</div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                            u.role === 'STATE_ADMIN' ? 'bg-red-50 text-red-800 border-red-200' :
                            u.role === 'DISTRICT_ADMIN' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            u.role === 'CONTROL_ROOM_OPERATOR' ? 'bg-blue-50 text-[#0052CC] border-blue-200' :
                            'bg-purple-50 text-purple-800 border-purple-200'
                          }`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="p-3 text-slate-700">
                          <div className="font-semibold">{u.district || 'Statewide (All 33 Districts)'}</div>
                          <div className="text-[10px] text-slate-400">{u.departmentName || 'Gujarat Police'}</div>
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(u.allowedModules || ['overview', 'cctv-gis', 'sentinel-live-wall']).map(mod => (
                              <span key={mod} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[9px] border border-slate-200">
                                {mod}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            ● {u.status}
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleEditClick(u)}
                              title="Edit Credentials & Permissions"
                              className="p-1.5 text-slate-600 hover:text-[#0052CC] hover:bg-blue-50 rounded transition cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleUserStatus(u.id)}
                              title={u.status === 'ACTIVE' ? 'Suspend Access' : 'Activate Account'}
                              className={`p-1.5 rounded transition cursor-pointer ${
                                u.status === 'ACTIVE' ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: RBAC MATRIX */}
      {activeAdminSubTab === 'roles' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase">Role-Based Access Control (RBAC) Matrix</h3>
            <p className="text-xs text-slate-500 mt-0.5">Enforced at action and route execution levels across Z-TRACS Model 1.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-[#00253e] text-white text-[10px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3 border-r border-slate-700">Role Title</th>
                  <th className="p-3 text-center">Create Node</th>
                  <th className="p-3 text-center">Edit Node</th>
                  <th className="p-3 text-center">Archive Node</th>
                  <th className="p-3 text-center">Maintenance</th>
                  <th className="p-3 text-center">Bulk Import</th>
                  <th className="p-3 text-center">Export Reports</th>
                  <th className="p-3 text-center">Manage Users</th>
                  <th className="p-3 text-center">Scope Restriction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(Object.keys(ROLE_PERMISSIONS_MAP) as UserRole[]).map(rKey => {
                  const perm = ROLE_PERMISSIONS_MAP[rKey];
                  return (
                    <tr key={rKey} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900 border-r border-slate-200">
                        <div>{perm.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{perm.description}</div>
                      </td>
                      <td className="p-3 text-center font-bold">{perm.canCreateCamera ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-bold">{perm.canEditCamera ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-bold">{perm.canArchiveCamera ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-bold">{perm.canMarkMaintenance ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-bold">{perm.canBulkImport ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-bold">{perm.canExportReports ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-bold">{perm.canManageUsers ? '✅' : '❌'}</td>
                      <td className="p-3 text-center font-mono text-[10px] font-bold text-[#0052CC]">
                        {perm.districtScoped ? 'District Scoped' : perm.departmentScoped ? 'Dept Scoped' : 'Statewide'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: VMS INVENTORY */}
      {activeAdminSubTab === 'vms' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">Registered VMS Reference Inventory</h3>
              <p className="text-xs text-slate-500 mt-0.5">Model 1 VMS Reference registry (Metadata sync pointers ONLY; no video federation).</p>
            </div>
            <button className="px-3 py-1.5 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8]">
              Register New VMS System
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#00253e] text-white text-[11px] uppercase font-bold">
                <tr>
                  <th className="p-3">VMS Identifier</th>
                  <th className="p-3">Vendor & Platform</th>
                  <th className="p-3">Parent Department</th>
                  <th className="p-3">Linked Camera Count</th>
                  <th className="p-3">Protocol</th>
                  <th className="p-3">Integration Type</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {vmsList.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-[#0052CC]">{v.id}</td>
                    <td className="p-3 font-sans font-semibold text-slate-900">{v.systemName} ({v.vendor})</td>
                    <td className="p-3 font-sans text-slate-700">{v.department}</td>
                    <td className="p-3 font-bold text-slate-900">{v.cameraCount.toLocaleString()} Nodes</td>
                    <td className="p-3 text-slate-600">{v.protocol}</td>
                    <td className="p-3 font-sans text-slate-600">{v.integrationType}</td>
                    <td className="p-3 text-right font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.status === 'Operational' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SYSTEM STATUS */}
      {activeAdminSubTab === 'system' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">Subsystem Diagnostics & Status Visibility</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time health monitoring of database cluster, PostGIS vector engine, and API gateways.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-full">
              ALL SUBSYSTEMS NOMINAL
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subsystems.map((sub, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="px-2 py-0.5 bg-blue-50 text-[#0052CC] font-bold text-[10px] rounded uppercase font-mono">
                    {sub.category}
                  </span>
                  <span className="flex items-center text-xs font-bold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {sub.status}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">{sub.name}</h4>
                <p className="text-[11px] text-slate-500 font-mono">{sub.details}</p>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-[11px] text-slate-600 font-mono">
                  <span>Latency: <strong className="text-slate-900">{sub.latencyMs}ms</strong></span>
                  <span>Uptime: <strong className="text-emerald-700">{sub.uptimePercentage}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: REGISTRY API */}
      {activeAdminSubTab === 'api' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase">Registry Sync API Gateway Specification</h3>
          <p className="text-xs text-slate-500">FastAPI backend REST endpoints specification for Z-TRACS Model 1.</p>
          <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto">
            <p className="text-slate-400">// Model 1 FastAPI Endpoint Architecture</p>
            <p className="mt-1">GET  /api/v1/cameras            - List camera records with facets</p>
            <p>GET  /api/v1/cameras/&#123;id&#125;       - Fetch CameraMasterRecord detail</p>
            <p>POST /api/v1/cameras            - Provision single camera record</p>
            <p>PATCH /api/v1/cameras/&#123;id&#125;      - Update metadata fields</p>
            <p>POST /api/v1/cameras/&#123;id&#125;/archive - Archive camera with audit payload</p>
            <p>GET  /api/v1/gis/features       - GeoJSON vector feature collection</p>
            <p>GET  /api/v1/health/events      - Live telemetry incident logs</p>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: IMPORT SCHEMAS */}
      {activeAdminSubTab === 'templates' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase">Standard Import Schemas & Templates</h3>
          <p className="text-xs text-slate-500">Official CSV/XLSX headers required for bulk camera onboarding.</p>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-2">
            <span className="font-bold text-slate-900 block">Required Header Columns:</span>
            <p className="text-slate-700">camera_code, name, type, latitude, longitude, address, city, district, department_id, owner, officer_name, officer_phone, officer_email, manufacturer, model, firmware_version, resolution, network_type, vms_platform_name, endpoint_reference, storage_type, retention_days, capability_anpr</p>
            <button className="mt-2 flex items-center space-x-1.5 px-3.5 py-2 bg-[#0052CC] text-white text-xs font-bold rounded-lg hover:bg-[#0041A8]">
              <Download className="w-4 h-4" />
              <span>Download CSV Template (.csv)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── PROVISION / EDIT OFFICIAL USER ACCOUNT MODAL ── */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-[#0052CC] border border-blue-200">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingUser ? 'Edit Government User Credentials' : 'Provision Official User Account'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Assign RBAC role, department, district jurisdiction, and section permissions.</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsAddUserModalOpen(false); setEditingUser(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
              
              {/* Row 1: Name & Badge ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name & Rank *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Rajesh K. Sharma, IPS"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Employee / Badge ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.badge}
                    onChange={(e) => setFormData(prev => ({ ...prev, badge: e.target.value.toUpperCase() }))}
                    placeholder="e.g. GJ-POL-2024-99"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  />
                </div>
              </div>

              {/* Row 2: Email & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="officer@gujaratpolice.gov.in"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Mobile Number</label>
                  <input
                    type="text"
                    value={formData.mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    placeholder="+91 98250 00000"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  />
                </div>
              </div>

              {/* Row 3: System Role & Passphrase */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned RBAC System Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  >
                    <option value="STATE_ADMIN">State Administrator (Level 5 — Full Access)</option>
                    <option value="DISTRICT_ADMIN">District Administrator (Level 4 — Collector/Admin)</option>
                    <option value="CONTROL_ROOM_OPERATOR">Control Room Operator (Level 3 — Video Wall Monitoring)</option>
                    <option value="POLICE_OFFICER">Police Field Officer (Level 3 — ANPR & Patrol)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Passphrase / Smart Card PIN *</label>
                  <div className="relative">
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      required
                      value={formData.passphrase}
                      onChange={(e) => setFormData(prev => ({ ...prev, passphrase: e.target.value }))}
                      placeholder="Enter secure passphrase..."
                      className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: Department Scope & District Jurisdiction Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Department Scope *</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">District Jurisdiction Scope *</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-[#0052CC]"
                  >
                    <option value="Statewide (All)">Statewide (All 33 Districts)</option>
                    {districts.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Module Permissions Matrix */}
              <div>
                <label className="font-bold text-slate-700 block mb-2">
                  Section & Module Access Permissions Matrix:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {availableModules.map(mod => {
                    const isChecked = formData.allowedModules.includes(mod.id);
                    return (
                      <label key={mod.id} className="flex items-center space-x-2 p-1.5 rounded hover:bg-white transition cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModuleSelection(mod.id)}
                          className="rounded border-slate-300 text-[#0052CC] focus:ring-[#0052CC]"
                        />
                        <span className="text-xs font-semibold text-slate-800">{mod.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setIsAddUserModalOpen(false); setEditingUser(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 bg-[#0052CC] hover:bg-[#0041A8] text-white font-bold rounded-lg transition shadow-xs cursor-pointer"
                >
                  {editingUser ? 'Save Credential Updates' : 'Provision User Account'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
