"use client";

import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { toApiError } from "@/lib/api/api-error";
import { useAdminUserActions, useAdminUsers } from "../hooks/use-admin-users";
import type { AdminUser, AdminUserCreatePayload, AdminUserFilters, AdminUserRole } from "../types/admin-types";

type UserFormValues = AdminUserCreatePayload;

export function UserManagementPanel() {
  const { message } = App.useApp();
  const [filters, setFilters] = useState<AdminUserFilters>({ page: 1, pageSize: 20 });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<UserFormValues>();
  const query = useAdminUsers(filters);
  const actions = useAdminUserActions();

  const closeModal = () => { setCreating(false); setEditing(null); form.resetFields(); };
  const submit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        const payload = {
          displayName: values.displayName,
          role: values.role,
          ...(values.password ? { password: values.password } : {}),
        };
        await actions.updateMutation.mutateAsync({ id: editing.id, payload });
        message.success("用户已更新");
      } else {
        await actions.createMutation.mutateAsync(values);
        message.success("用户已创建");
      }
      closeModal();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(toApiError(error).message);
    }
  };
  const columns: ColumnsType<AdminUser> = [
    { title: "用户名", dataIndex: "username", key: "username", width: 180 },
    { title: "显示名称", dataIndex: "displayName", key: "displayName", width: 180 },
    { title: "角色", dataIndex: "role", key: "role", width: 120, render: (role: AdminUserRole) => <Tag color={role === "ROLE_ADMIN" ? "blue" : "default"}>{role === "ROLE_ADMIN" ? "管理员" : "普通用户"}</Tag> },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180, render: (value: string) => new Date(value).toLocaleString() },
    { title: "操作", key: "actions", width: 160, render: (_, row) => <Space size={4} className="whitespace-nowrap"><Button type="link" onClick={() => { setEditing(row); form.setFieldsValue({ displayName: row.displayName, role: row.role, username: row.username }); }}>编辑</Button><Popconfirm title="确认删除该用户？" description="删除后无法恢复，且已有业务数据的用户不可删除。" okText="删除" cancelText="取消" onConfirm={() => actions.deleteMutation.mutateAsync(row.id).then(() => message.success("用户已删除")).catch((error) => message.error(toApiError(error).message))}><Button type="link" danger loading={actions.deleteMutation.isPending}>删除</Button></Popconfirm></Space> },
  ];

  return <div className="grid gap-4">
    <div className="grid w-full min-w-0 items-end gap-2" style={{ gridTemplateColumns: "minmax(0, 1fr) 128px 128px 112px auto auto auto" }}>
      <Input.Search placeholder="按用户名搜索" allowClear onSearch={(username) => setFilters((current) => ({ ...current, username: username || undefined, page: 1 }))} />
      <Input type="date" aria-label="创建开始日期" onChange={(event) => setFilters((current) => ({ ...current, createdFrom: event.target.value || undefined, page: 1 }))} />
      <Input type="date" aria-label="创建结束日期" onChange={(event) => setFilters((current) => ({ ...current, createdTo: event.target.value || undefined, page: 1 }))} />
      <Select placeholder="全部角色" allowClear options={[{ value: "ROLE_USER", label: "普通用户" }, { value: "ROLE_ADMIN", label: "管理员" }]} onChange={(role) => setFilters((current) => ({ ...current, role, page: 1 }))} />
      <Button onClick={() => setFilters({ page: 1, pageSize: 20 })}>重置筛选</Button><Button onClick={() => query.refetch()} loading={query.isFetching}>刷新</Button><Button type="primary" onClick={() => { setCreating(true); form.resetFields(); form.setFieldsValue({ role: "ROLE_USER" }); }}>新建</Button>
    </div>
    {query.error ? <Alert type="error" showIcon title="用户列表读取失败" description={toApiError(query.error).message} action={<Button onClick={() => query.refetch()}>重试</Button>} /> : null}
    <Table rowKey="id" columns={columns} dataSource={query.data?.items ?? []} loading={query.isLoading} locale={{ emptyText: "暂无符合条件的用户" }} pagination={{ current: filters.page, pageSize: filters.pageSize, total: query.data?.total ?? 0, showSizeChanger: true, onChange: (page, pageSize) => setFilters((current) => ({ ...current, page, pageSize })) }} scroll={{ x: 800 }} />
    <Modal title={editing ? "编辑用户" : "新建用户"} open={creating || editing !== null} onCancel={closeModal} onOk={submit} confirmLoading={actions.createMutation.isPending || actions.updateMutation.isPending}>
      <Form form={form} layout="vertical">
        <Form.Item name="username" label="用户名" rules={[{ required: !editing, message: "请输入用户名" }]}><Input disabled={Boolean(editing)} maxLength={32} /></Form.Item>
        <Form.Item name="displayName" label="显示名称"><Input maxLength={64} /></Form.Item>
        <Form.Item name="password" label={editing ? "新密码（不修改请留空）" : "密码"} rules={[{ required: !editing, message: "请输入密码" }, { min: 6, message: "密码至少 6 位" }]}><Input.Password maxLength={64} /></Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}><Select options={[{ value: "ROLE_USER", label: "普通用户" }, { value: "ROLE_ADMIN", label: "管理员" }]} /></Form.Item>
      </Form>
    </Modal>
  </div>;
}
