# CPBS Tabla 29 — Unidades de Medida

Las unidades de medida CPBS para facturación electrónica en Panamá siguen el catálogo de la DGI. A continuación se listan las más utilizadas, especialmente para servicios y bienes suministrados al Estado.

| Código / Símbolo | Nombre de la Unidad | Descripción / Uso Típico |
| :---: | :--- | :--- |
| **und** | Unidad | Uso genérico para bienes individuales (computadoras, sillas). |
| **Mes** | Mes | Servicios recurrentes mensuales (alquileres, suscripciones). |
| **Hora** | Hora | Servicios profesionales por tiempo (consultorías, soporte). |
| **Día** | Día | Jornadas de trabajo o servicios diarios. |
| **Año** | Año | Contratos o pólizas de duración anual. |
| **kg** | Kilogramos | Productos pesables. |
| **m** | Metros | Productos por longitud. |
| **m²** | Metro Cuadrado | Servicios por área (limpieza, mantenimiento de terrenos). |
| **Actividad** | Actividad | Servicios facturados por hito o acción realizada. |
| **Persona** | Persona | Servicios por cantidad de asistentes o beneficiarios. |
| **Visita** | Visita | Servicios de soporte técnico o inspección en sitio. |
| **Viaje** | Viaje | Servicios de transporte o fletes. |
| **Paquete** | Paquete | Suministros agrupados. |

---

## Reglas de Implementación

1. El campo `unidadMedidaCPBS` es obligatorio para facturas a Gobierno (`tipoClienteFE = 03`).
2. Debe coincidir con uno de los valores permitidos por la DGI.
3. Se recomienda pre-configurar este valor en la ficha del producto en el Inventario.
