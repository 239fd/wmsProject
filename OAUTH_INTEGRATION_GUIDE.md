# Гайд по интеграции OAuth авторизации (Яндекс/Google)

## Описание процесса OAuth авторизации

### 1. Инициация OAuth (кнопки "Войти через...")

На странице логина/регистрации пользователь нажимает кнопку:
- **"Войти через Яндекс"** или **"Войти через Google"**

**Frontend действие:**
```javascript
// При нажатии на кнопку редиректим на бэкенд
const handleYandexLogin = () => {
  window.location.href = 'http://localhost:7777/api/oauth/authorize/yandex?type=login';
};

const handleGoogleLogin = () => {
  window.location.href = 'http://localhost:7777/api/oauth/authorize/google?type=login';
};
```

### 2. Бэкенд редиректит на OAuth провайдера

Бэкенд автоматически перенаправляет пользователя на:
- Яндекс ID для авторизации
- Google OAuth для авторизации

### 3. Возврат после авторизации у провайдера

После успешной авторизации провайдер редиректит обратно на бэкенд:
```
http://localhost:7777/api/oauth/callback/{provider}?code=XXX&state=YYY
```

### 4. Бэкенд обрабатывает callback

Бэкенд получает код авторизации, обменивает его на токены провайдера, получает данные пользователя.

**Возможны 2 сценария:**

#### Сценарий A: Пользователь уже существует (логин)

Бэкенд генерирует JWT токены и редиректит на:
```
http://localhost:3000/auth/callback?access_token=XXX&refresh_token=YYY
```

**Frontend задача:**
Создать специальную страницу `/auth/callback` которая обработает токены и редиректнет на `/main`:

```javascript
// AuthCallback.jsx - новый компонент
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      // Сохраняем токены
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      
      // Показываем успешное сообщение (опционально)
      console.log('OAuth авторизация успешна!');
      
      // Редиректим на главную страницу
      navigate('/main');
    } else {
      // Если нет токенов - что-то пошло не так
      console.error('Токены не получены');
      navigate('/login');
    }
  }, [navigate]);

  // Показываем загрузку пока обрабатываем
  return (
    <div className="auth-callback-loader">
      <p>Завершение авторизации...</p>
    </div>
  );
};

export default AuthCallback;
```

#### Сценарий B: Новый пользователь (регистрация)

Бэкенд создает временную регистрацию и редиректит на страницу выбора роли:
```
http://localhost:3000/role?token=TEMP_TOKEN&email=user@email.com&name=UserName
```

**Frontend задача:**
На странице `/role` показать форму выбора роли:

```javascript
// В компоненте RoleSelection
const [token, setToken] = useState('');
const [email, setEmail] = useState('');
const [name, setName] = useState('');
const [selectedRole, setSelectedRole] = useState('');

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  setToken(params.get('token') || '');
  setEmail(decodeURIComponent(params.get('email') || ''));
  setName(decodeURIComponent(params.get('name') || ''));
}, []);

const handleCompleteRegistration = async () => {
  try {
    const response = await fetch('http://localhost:7777/api/oauth/complete-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        temporaryToken: token,
        role: selectedRole, // "DIRECTOR" | "WAREHOUSE_MANAGER" | "FOREMAN" | "WORKER"
      }),
    });

    if (response.ok) {
      const data = await response.json();
      // Сохраняем токены
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      
      // Редиректим на главную
      navigate('/');
    } else {
      // Обработка ошибки
      const error = await response.json();
      alert(error.message);
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('Произошла ошибка при завершении регистрации');
  }
};
```

## Структура кнопок OAuth на фронтенде

### На странице Login (`/login`):

```jsx
<div className="oauth-buttons">
  <button 
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/yandex?type=login'}
    className="oauth-button yandex"
  >
    <YandexIcon />
    Войти через Яндекс
  </button>
  
  <button 
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/google?type=login'}
    className="oauth-button google"
  >
    <GoogleIcon />
    Войти через Google
  </button>
</div>
```

### На странице Register (`/register`):

```jsx
<div className="oauth-buttons">
  <button 
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/yandex?type=register'}
    className="oauth-button yandex"
  >
    <YandexIcon />
    Зарегистрироваться через Яндекс
  </button>
  
  <button 
    onClick={() => window.location.href = 'http://localhost:7777/api/oauth/authorize/google?type=register'}
    className="oauth-button google"
  >
    <GoogleIcon />
    Зарегистрироваться через Google
  </button>
</div>
```

## Страница выбора роли (`/role`)

Нужно создать новый роут и компонент для выбора роли:

```jsx
// RoleSelection.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const RoleSelection = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const emailParam = params.get('email');
    const nameParam = params.get('name');

    if (!tokenParam) {
      // Если нет токена - редирект на логин
      navigate('/login');
      return;
    }

    setToken(tokenParam);
    setEmail(decodeURIComponent(emailParam || ''));
    setName(decodeURIComponent(nameParam || ''));
  }, [navigate]);

  const roles = [
    { value: 'DIRECTOR', label: 'Директор', description: 'Полный доступ к системе' },
    { value: 'WAREHOUSE_MANAGER', label: 'Заведующий складом', description: 'Управление складом' },
    { value: 'FOREMAN', label: 'Бригадир', description: 'Управление бригадой' },
    { value: 'WORKER', label: 'Рабочий', description: 'Работа с заказами' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedRole) {
      alert('Пожалуйста, выберите роль');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:7777/api/oauth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          temporaryToken: token,
          role: selectedRole,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        navigate('/');
      } else {
        const error = await response.json();
        alert(error.message || 'Произошла ошибка при завершении регистрации');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Произошла ошибка при завершении регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-selection-container">
      <h2>Завершение регистрации</h2>
      <p>Добро пожаловать, {name}!</p>
      <p>Email: {email}</p>
      
      <form onSubmit={handleSubmit}>
        <h3>Выберите вашу роль:</h3>
        
        <div className="roles-list">
          {roles.map((role) => (
            <label key={role.value} className="role-option">
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={selectedRole === role.value}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
              <div className="role-info">
                <h4>{role.label}</h4>
                <p>{role.description}</p>
              </div>
            </label>
          ))}
        </div>

        <button type="submit" disabled={loading || !selectedRole}>
          {loading ? 'Завершение регистрации...' : 'Завершить регистрацию'}
        </button>
      </form>
    </div>
  );
};

export default RoleSelection;
```

## Добавление роутов в React Router

```jsx
// App.jsx или routes.jsx
import AuthCallback from './components/AuthCallback';
import RoleSelection from './components/RoleSelection';

<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/auth/callback" element={<AuthCallback />} />
  <Route path="/role" element={<RoleSelection />} />
  <Route path="/main" element={<Main />} />
  {/* остальные роуты */}
</Routes>
```

## Обработка ошибок

Все ошибки возвращаются в формате:
```json
{
  "success": false,
  "message": "Описание ошибки",
  "timestamp": "2025-11-03T12:00:00Z"
}
```

## Итоговый Flow

1. **Пользователь нажимает "Войти через Яндекс/Google"**
2. **Редирект на бэкенд** → `/api/oauth/authorize/{provider}?type=login`
3. **Бэкенд редиректит на провайдера** (Яндекс/Google)
4. **Пользователь авторизуется** у провайдера
5. **Провайдер возвращает на бэкенд** → `/api/oauth/callback/{provider}?code=XXX`
6. **Бэкенд обрабатывает:**
   - **Если пользователь существует**: редирект на `/auth/callback?access_token=XXX&refresh_token=YYY`
   - **Если новый пользователь**: редирект на `/role?token=XXX&email=YYY&name=ZZZ`
7. **Frontend:**
   - На `/auth/callback` - сохраняет токены и редиректит на `/main`
   - На `/role` - показывает форму выбора роли → отправляет POST на `/api/oauth/complete-registration` → сохраняет токены → редиректит на `/main`

## Важные моменты

1. **URL-параметры декодируются**: имя пользователя может содержать кириллицу, используйте `decodeURIComponent()`
2. **Временный токен** действителен 15 минут
3. **Очищайте URL** после сохранения токенов: `window.history.replaceState({}, '', '/login')`
4. **Проверяйте наличие токенов** перед отправкой запроса на завершение регистрации

## Тестирование

1. Для Яндекс OAuth: Redirect URI = `http://localhost:7777/api/oauth/callback/yandex`
2. Для Google OAuth: Redirect URI = `http://localhost:7777/api/oauth/callback/google`

Эти URI должны быть настроены в консолях разработчика Яндекс и Google.

