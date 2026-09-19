# Inventario

Sistema de inventario con reconocimiento de productos por foto: subís una imagen y el sistema la identifica por código de barras o, si no hay ninguno visible, por similitud visual (umbral de confianza >90%, o >85% si corrobora con 2+ fotos propias del producto). Cada producto admite hasta 6 fotos (distintos ángulos), lo que sube tanto la cobertura como la confianza del reconocimiento. Panel de administrador con login para dar de alta/editar/eliminar (borrado lógico) productos y gestionar usuarios con rol de administrador o vendedor, y una vista pública de solo lectura (descripción, precio, stock, foto ampliable en modal — sin código de barras) pensada para usarse desde el celular.

Ver [docs/PROYECTO.md](docs/PROYECTO.md) para la arquitectura completa, el modelo de datos, la API y las decisiones de seguridad.

## Quickstart

```bash
cp .env.example .env   # completar con valores propios (contraseñas, JWT_SECRET)
docker compose up --build -d
docker compose ps       # los 4 servicios deben quedar "healthy"

# Crear el primer usuario administrador (no hay registro público)
docker compose exec backend python -m scripts.create_admin --username admin --password 'una-contraseña-larga'
```

- Frontend / catálogo público: http://localhost:5173
- Panel admin: http://localhost:5173/admin/login
- API (solo accesible desde esta máquina): http://localhost:8000/api — [docs interactivas](http://localhost:8000/docs)
- Consola de MinIO: http://localhost:9001

Para probarlo desde el celular en la misma red, ver [la sección correspondiente en docs/PROYECTO.md](docs/PROYECTO.md#11-uso-desde-el-celular-lan).

## Tests

```bash
# Backend (unitarios/integración)
docker compose exec backend pytest -v

# End-to-end (requiere el stack levantado)
cd e2e && npm install && npx playwright install --with-deps chromium && npm test
```

## Estructura del repo

```
backend/    API FastAPI (auth, CRUD, reconocimiento), migraciones Alembic, tests pytest
frontend/   React + Vite + Tailwind (catálogo público y panel admin)
e2e/        Suite Playwright contra el stack real
docs/       Arquitectura y decisiones técnicas
scripts/    Setup de MinIO y creación del admin inicial
```
