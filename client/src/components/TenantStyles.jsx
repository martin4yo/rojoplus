/**
 * Componente que inyecta estilos dinámicos del tenant en el DOM
 * Los estilos están en client/src/index.css
 */
export default function TenantStyles() {
  return (
    <style>{`
      :root {
        /* Color Primary */
        --color-primary: #DC2626;
        --color-primary-dark: #991B1B;
        --color-primary-light: #FCA5A5;

        /* Color Secondary */
        --color-secondary: #7C3AED;
        --color-secondary-dark: #5B21B6;
        --color-secondary-light: #C4B5FD;

        /* Accents & States */
        --color-accent: #22D3EE;
        --color-success: #10B981;
        --color-warning: #F59E0B;
        --color-error: #EF4444;
        --color-info: #3B82F6;

        /* Backgrounds */
        --color-bg-primary: #FFFFFF;
        --color-bg-secondary: #F9FAFB;

        /* Text */
        --color-text-primary: #111827;
        --color-text-secondary: #6B7280;
        --color-border: #E5E7EB;
      }
    `}</style>
  )
}
