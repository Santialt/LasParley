# La Banca del Finde

App estatica para seguir apuestas deportivas grupales: stake, cuota, estado, balance, ROI y rendimiento de la banda.

La app incluye una pantalla de ingreso simple para que el link no quede abierto a cualquiera. La clave por defecto esta en `app.js`:

```js
const ACCESS_CODE = "parley";
```

Esto sirve como filtro liviano para amigos. No es seguridad real de servidor, porque GitHub Pages publica archivos estaticos.

## Supabase

La app guarda las apuestas en Supabase para que todos vean lo mismo desde cualquier dispositivo.

Antes de usarla, abrir Supabase y pegar el contenido de `supabase.sql` en:

`SQL Editor` -> `New query` -> `Run`

Ese script crea la tabla `bets` y las politicas para que la app pueda leer, crear, actualizar y borrar tickets usando la publishable key.

## Como hostearla en GitHub Pages

1. Crear un repo nuevo en GitHub.
2. Subir estos archivos al repo:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. En GitHub, entrar a `Settings`.
4. Ir a `Pages`.
5. En `Build and deployment`, elegir:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Guardar.

GitHub va a publicar la pagina en una URL parecida a:

```text
https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/
```

## Importante

Los datos principales se guardan en Supabase. El navegador mantiene una copia local solo como backup si falla la conexion.
