# Imágenes

Coloca aquí los archivos de imagen que quieras usar en la app (logo, fotos,
íconos personalizados, imágenes de fondo, etc.).

Todo lo que pongas en `public/` se sirve tal cual, sin procesar, desde la
raíz del sitio. Para usar una imagen en el código, referencia la ruta con
`/images/<nombre-del-archivo>`, por ejemplo:

```tsx
<img src="/images/logo.png" alt="ATLOS" />
```

```css
background-image: url('/images/hero-bg.jpg');
```

No hace falta importar el archivo ni instalar nada — Vite copia todo el
contenido de `public/` al build final (`dist/`) sin cambios.
