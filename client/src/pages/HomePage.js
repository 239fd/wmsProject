import React from 'react';
import {Box, Typography, Grid, Paper, Button} from '@mui/material';
import {useNavigate} from 'react-router-dom';
import AnalyticsImage from '../assets/images/AnalyticsImage.svg';
import ApproveImage from '../assets/images/ApproveImage.svg';

const sections = [
    {
        title: 'Облачная WMS для вашего бизнеса',
        description: 'Все, что нужно – в одной системе: поставки, отгрузки, склады и отчетность.',
        image: null,
        imageLeft: false,
    },
    {
        title: 'WMS это',
        description:
            'Система управления складом - это высокоэффективное программное решение, которое оптимизирует все процессы, связанные с хранением и движением товаров на складе. Основная цель WMS — повысить эффективность операций, минимизировать затраты и улучшить качество обслуживания клиентов.',
        image: AnalyticsImage,
        imageLeft: true,
    },
    {
        title: 'Особенности программы',
        description: `Простая программа для склада, логистики ТМЦ и учета. Приемка и отгрузка товара, перемещения, инвентаризация и списание.\nКонтроль остатков.\nПоэкземплярный и партионный учет, учёт по сериям и срокам годности.\nРезервирование товара, адресное хранение, листы подбора, сверка комплектации.\nПоддержка нескольких складов.`,
        image: ApproveImage,
        imageLeft: false,
    },
];

const MAX_WIDTH = 1440;

const HomePage = () => {
    const navigate = useNavigate();
    return (
        <Box sx={{width: '100%', bgcolor: 'background.default', minHeight: '100vh'}}>
            <Box sx={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <Box sx={{width: '100%', maxWidth: MAX_WIDTH, px: {xs: 2, md: 6}, my: 3}}>
                    <Paper elevation={2} sx={{ background: '#fff', borderRadius: 4, p: { xs: 3, md: 6 }, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.04)', width: '100%' }}>
                        <Box
                            sx={{
                                width: '100%',
                                display: 'flex',
                                flexDirection: { xs: 'column', md: 'row' },
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 6,
                            }}
                        >
                            <Box sx={{ flex: 1 }}>
                                <Typography
                                    variant="h2"
                                    color="text.primary"
                                    sx={{ fontWeight: 800, mb: 2, textAlign: { xs: 'center', md: 'left' } }}
                                >
                                    WMS — складская система нового поколения
                                </Typography>
                                <Typography
                                    variant="h5"
                                    color="text.secondary"
                                    sx={{ mb: 4, textAlign: { xs: 'center', md: 'left' } }}
                                >
                                    Управляйте складом, закупками и отчетностью в облаке. Просто. Надежно. Современно.
                                </Typography>
                                <Box display="flex" gap={2} justifyContent={{ xs: 'center', md: 'flex-start' }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        onClick={() => navigate('/login')}
                                    >
                                        Вход
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        size="large"
                                        onClick={() => navigate('/register')}
                                    >
                                        Регистрация
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
            </Box>
            <Box sx={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                {sections.map((section, idx) => (
                    <Box key={idx} sx={{width: '100%', maxWidth: MAX_WIDTH, px: {xs: 2, md: 6}, my: 3}}>
                        <Paper elevation={2} sx={{
                            background: '#fff',
                            borderRadius: 4,
                            p: {xs: 2, md: 4},
                            boxShadow: '0 2px 16px 0 rgba(0,0,0,0.04)'
                        }}>
                            <Grid
                                container
                                spacing={4}
                                alignItems="center"
                                minHeight={{md: 260}}
                                direction={section.imageLeft ? 'row-reverse' : 'row'}
                            >
                                {section.image && (
                                    <Grid item xs={12} md={6}
                                          sx={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                        <Box sx={{width: '100%', display: 'flex', justifyContent: 'center'}}>
                                            <img
                                                src={section.image}
                                                alt={section.title}
                                                style={{
                                                    maxWidth: 340,
                                                    width: '100%',
                                                    height: 'auto',
                                                    borderRadius: 12,
                                                    boxShadow: '0 2px 12px 0 rgba(0,0,0,0.04)',
                                                }}
                                            />
                                        </Box>
                                    </Grid>
                                )}
                                <Grid item xs={12} md={section.image ? 6 : 12} sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: {xs: 'center', md: section.imageLeft ? 'flex-end' : 'flex-start'}
                                }}>
                                    <Typography
                                        variant="h4"
                                        color="text.primary"
                                        gutterBottom
                                        sx={{
                                            fontWeight: 700,
                                            textAlign: {xs: 'center', md: section.imageLeft ? 'right' : 'left'},
                                            mb: 1
                                        }}
                                    >
                                        {section.title}
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        color="text.secondary"
                                        sx={{
                                            whiteSpace: 'pre-line',
                                            fontSize: 17,
                                            textAlign: {xs: 'center', md: section.imageLeft ? 'right' : 'left'},
                                            maxWidth: 480,
                                        }}
                                    >
                                        {section.description}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default HomePage;
