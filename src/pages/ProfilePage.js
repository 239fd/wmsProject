import React, { useState } from 'react';
import { Box, Avatar, TextField, Button, Stack, Paper } from '@mui/material';

const initialUser = {
  name: 'Иван',
  surname: 'Иванов',
  patronymic: 'Иванович',
  email: 'ivanov@example.com',
  avatar: '',
};

const ProfilePage = () => {
  const [user, setUser] = useState(initialUser);
  const [editUser, setEditUser] = useState(initialUser);
  const [, setAvatar] = useState(initialUser.avatar);
  const [avatarPreview, setAvatarPreview] = useState(initialUser.avatar);
  const [editing, setEditing] = useState(false);

  const handleChange = (e) => {
    setEditUser({ ...editUser, [e.target.name]: e.target.value });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = () => setEditing(true);
  const handleCancel = () => {
    setEditUser(user);
    setAvatarPreview(user.avatar);
    setEditing(false);
  };
  const handleSave = () => {
    setUser(editUser);
    setAvatar(avatarPreview);
    setEditing(false);
  };

  return (
    <Box maxWidth={500} mx="auto" mt={4}>
      <Paper sx={{ p: 4, borderRadius: 4 }}>
        <Stack spacing={3} alignItems="center">
          <Box position="relative">
            <Avatar src={avatarPreview} sx={{ width: 100, height: 100, mb: 1 }} />
            {editing && (
              <Button variant="outlined" component="label" size="small" sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}>
                Изменить
                <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
              </Button>
            )}
          </Box>
          <Stack spacing={2} width="100%">
            <TextField label="Имя" name="name" value={editUser.name} onChange={handleChange} fullWidth disabled={!editing} />
            <TextField label="Фамилия" name="surname" value={editUser.surname} onChange={handleChange} fullWidth disabled={!editing} />
            <TextField label="Отчество" name="patronymic" value={editUser.patronymic} onChange={handleChange} fullWidth disabled={!editing} />
            <TextField label="Email" name="email" value={editUser.email} onChange={handleChange} fullWidth disabled={!editing} />
          </Stack>
          {!editing ? (
            <Button variant="contained" onClick={handleEdit}>Редактировать</Button>
          ) : (
            <Stack direction="row" spacing={2}>
              <Button variant="contained" color="primary" onClick={handleSave}>Сохранить</Button>
              <Button variant="outlined" color="secondary" onClick={handleCancel}>Отмена</Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default ProfilePage;
