'use client'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body style={{background:'#09090b',color:'white',padding:'2rem',fontFamily:'monospace'}}>
        <h1>Erro: {error.digest}</h1>
        <pre>{error.message}</pre>
        <pre>{error.stack}</pre>
      </body>
    </html>
  )
}
