import React from 'react';
import Navbar from './Navbar';
import { Container } from '@mui/material';
import { Outlet } from 'react-router-dom';

const GuestLayout = () => (
  <>
    <Navbar />
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Outlet />
    </Container>
  </>
);

export default GuestLayout;

