import React, { useState } from 'react';
import { Button, Container, Typography, Box, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const roles = [
  { value: 'WORKER', label: 'Работник' },
  { value: 'ACCOUNTANT', label: 'Бухгалтер' },
  { value: 'DIRECTOR', label: 'Директор' },
];

const roleMapping = {
  'WORKER': 'Работник',
  'ACCOUNTANT': 'Бухгалтер',
  'DIRECTOR': 'Директор',
};

const RoleSelectPage = () => {
  const [role, setRole] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const navigate = useNavigate();

  const handleRoleChange = (e) => {
    setRole(e.target.value);
    if (e.target.value === 'DIRECTOR') setCompanyCode('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = {
      role: roleMapping[role],
      roleCode: role,
      companyCode
    };
    localStorage.setItem('wms_user', JSON.stringify(user));
    navigate('/main');
  };

  return (
    <Container maxWidth="xs">
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh">
        <Typography variant="h5" gutterBottom>Выберите роль</Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <FormControl fullWidth margin="normal">
            <InputLabel id="role-label">Роль</InputLabel>
            <Select labelId="role-label" value={role} label="Роль" variant="outlined" onChange={handleRoleChange} required>
              {roles.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {(role === 'WORKER' || role === 'ACCOUNTANT') && (
            <TextField label="Код предприятия" value={companyCode} onChange={e => setCompanyCode(e.target.value)} fullWidth margin="normal" required />
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Войти</Button>
        </form>
      </Box>
    </Container>
  );
};

export default RoleSelectPage;
