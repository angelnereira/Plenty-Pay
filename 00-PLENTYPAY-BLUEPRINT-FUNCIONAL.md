# PlentyPay — Blueprint Funcional

> Este documento describe **qué es PlentyPay y qué hace**, no cómo está
> construido por dentro. No menciona lenguajes de programación, bases de
> datos ni herramientas: cualquier equipo, con cualquier tecnología, debería
> poder leer esto y construir el mismo sistema. Es el plano de la casa, no
> los planos eléctricos.

## 1. Qué es PlentyPay

Imagina un país donde cualquier persona con un teléfono puede cobrar, pagar,
vender, entregar y llevar sus cuentas sin fricción — sin efectivo obligatorio,
sin papeleo, sin que el dinero se sienta lento ni inseguro. Eso es lo que
PlentyPay construye: **una sola plataforma** donde un negocio vive por
completo — vende, cobra en cualquier forma de pago, controla su inventario,
paga a su equipo, cumple con el fisco, entiende sus números, y llega a más
clientes a través de un mercado compartido — y donde una persona, sin tener
ningún negocio, puede pagar, recibir dinero, acumular puntos y comprar en
cualquier comercio de la red.

No es un punto de venta al que le agregaron pagos. No es una app de pagos que
le agregaron facturación. Es una sola plataforma diseñada desde el inicio
para que el dinero y el negocio sean la misma cosa.

## 2. A quién sirve

- **Negocios pequeños y medianos**: tiendas, restaurantes, farmacias,
  ferreterías, salones — cualquiera que venda un producto o un servicio.
- **Negocios con varias sucursales**, que necesitan verlas todas desde un
  solo lugar.
- **Personas**, sin necesidad de tener un negocio: para pagar, recibir
  dinero de otra persona, acumular puntos, y comprar en el mercado compartido.
- **Repartidores y transportistas**, propios de un negocio o independientes.
- **El equipo de la plataforma misma**, que necesita dar soporte, vigilar que
  todo funcione, y aprobar a los nuevos negocios que se suman.

## 3. Los pilares de la plataforma

### 3.1 Ventas y cobros

El corazón operativo de cualquier negocio: un mostrador donde se escanean o
seleccionan productos, se arma una cuenta, y se cobra — con cualquier
combinación de formas de pago en la misma venta si el cliente lo necesita.
Funciona aunque el internet se caiga un momento: la venta se guarda y se pone
al día sola en cuanto vuelve la conexión, sin que el cajero note nada raro.
Hay una pantalla para el cajero y, si el mostrador lo permite, otra pantalla
mirando hacia el cliente para que vea su total y su recibo en tiempo real. Al
cerrar la venta, el cliente recibe su comprobante al instante — en papel si
el negocio tiene impresora, y siempre en digital.

### 3.2 Pagos y billetera — el corazón nuevo de PlentyPay

Aquí es donde PlentyPay deja de ser "un sistema más" y se convierte en
infraestructura de dinero real. Un cliente paga **acercando su teléfono**,
**escaneando un código**, o **usando su tarjeta** — y no importa qué banco,
qué billetera o qué marca de tarjeta tenga: PlentyPay habla el idioma de
todas las formas de pago que la gente ya usa en su día a día, desde las
billeteras móviles más populares del país hasta las tarjetas internacionales
y las billeteras de los grandes fabricantes de teléfonos.

Cada persona y cada negocio tiene, dentro de PlentyPay, **una cuenta de
saldo propia** — su billetera. El dinero puede entrar ahí (una venta, un
pago que le hace otra persona, una devolución) y puede salir (un pago, un
retiro). Cuando entra un pago, PlentyPay reparte automáticamente cada
centavo en el momento: lo que le corresponde al negocio, lo que corresponde
de comisión a la plataforma, y lo que corresponde de impuesto — sin que
nadie tenga que sacar la calculadora. Y cada uno de esos movimientos queda
escrito para siempre en un libro de cuentas que **nunca se puede borrar ni
editar**: si algo estuvo mal, se corrige con un movimiento nuevo que deja
rastro de ambos, nunca tapando el original. Es la misma disciplina con la
que un banco lleva sus cuentas, aplicada a cada venta, sin importar cuán
pequeña sea.

No todo pago se resuelve al instante — a veces el banco del cliente necesita
que apruebe algo en su propia app, o simplemente tarda en responder.
PlentyPay sabe distinguir "no se pudo cobrar" de "todavía no sabemos qué
pasó", y nunca asume lo peor ni lo mejor sin confirmación: un pago que queda
en el limbo se investiga, nunca se ignora ni se cobra dos veces por error.

### 3.3 Catálogo, multi-tienda y mercado compartido

Cada negocio tiene su propio catálogo — fotos, precios, existencias — y
cada negocio con varias sucursales lo administra todo desde un solo lugar,
sin duplicar el trabajo. Pero el catálogo no tiene por qué quedarse encerrado
dentro de un solo negocio: PlentyPay ofrece un **mercado compartido** donde
cualquier cliente puede descubrir productos de distintos comercios de la
red, armar un carrito con artículos de varios negocios a la vez, y pagar
todo en una sola operación — como comprar en varias tiendas del mismo centro
comercial sin hacer más de una fila.

### 3.4 Facturación y cumplimiento con la autoridad fiscal

Cada venta puede generar, en el momento, el comprobante formal que exige la
autoridad tributaria del país — con su código único de verificación y un
código de barras que cualquiera puede escanear para comprobar que es
auténtico. El negocio decide, venta por venta o de forma automática según un
monto, si esa venta necesita ese comprobante formal o si un recibo simple
basta (típicamente para ventas pequeñas del día a día). Cuando algo se
corrige después de facturado, existen notas de crédito y de débito para
ajustarlo sin borrar el historial. El comprobante llega también al correo
del cliente automáticamente.

### 3.5 Inventario

Control de existencias por bodega o almacén, con soporte para productos que
manejan lotes (por fecha de vencimiento o de origen). El sistema avisa antes
de que un producto se agote, calculando qué tan rápido se vende cada
artículo — no con una alarma genérica, sino aprendiendo el ritmo real de cada
producto — y sugiere cuánto y cuándo conviene volver a comprar. Las compras a
proveedores y lo que efectivamente llega al almacén quedan registrados para
que el inventario en pantalla siempre refleje la realidad.

### 3.6 Logística y entregas

Asignación de pedidos a repartidores propios o externos, con seguimiento en
tiempo real que el cliente puede abrir desde un enlace público — sin
necesitar cuenta, sin instalar nada. Cada punto de la entrega se confirma
escaneando un código, de forma que siempre se sabe exactamente dónde está un
pedido y quién lo tuvo en sus manos en cada momento.

### 3.7 Equipo, turnos y nómina

El equipo marca su llegada y salida con reconocimiento facial, un código, su
huella, o acercando una credencial — de forma que el sistema confirma que la
persona está realmente presente, no solo que alguien tocó un botón en
nombre de otro. Se organizan turnos y horarios por persona, se calcula la
nómina, y existe un modo de "quiosco": una pantalla fija en la entrada del
negocio donde todo el equipo marca su llegada sin depender de su propio
teléfono.

### 3.8 Créditos y lealtad

Un negocio puede llevarle la cuenta a un cliente de confianza al que le
vende a crédito, y puede premiar la fidelidad con un programa de puntos que
se acumulan con cada compra y se canjean después. Estos movimientos comparten
la misma disciplina contable que el dinero real: un punto de lealtad se
registra con el mismo cuidado que un dólar cobrado.

### 3.9 Inteligencia de negocio

Paneles que muestran qué se vende más, quién compra más, y qué tan rentable
es cada producto. El sistema detecta por sí solo comportamientos fuera de lo
normal — una venta inusualmente alta, una caída repentina — y proyecta cómo
podrían verse las ventas de los próximos meses según el historial real. Se
puede simplemente preguntar, como se le preguntaría a una persona ("¿cuánto
vendí el mes pasado en la sucursal de Colón?"), y el sistema responde con la
cifra exacta. También agrupa a los clientes según cómo compran, para poder
dirigirles una promoción a quienes de verdad les interesa.

### 3.10 Soporte y asistente

Un asistente conversacional dentro de la plataforma resuelve dudas al
instante, y una mesa de ayuda con tickets atiende lo que necesita a una
persona real. La comunicación por mensajería (el mismo chat que la gente ya
usa todos los días) sirve hoy para avisos y recibos, y es la puerta de
entrada para, más adelante, poder pagar y cobrar sin salir de la
conversación.

### 3.11 Administración, roles y seguridad

Cada negocio decide quién de su equipo puede ver o hacer qué — un cajero no
tiene por qué ver los reportes financieros completos, y nadie fuera de
administración puede borrar una venta ya hecha. El acceso se puede reforzar
con la huella o el rostro del propio dispositivo, sin depender solo de una
contraseña. Toda acción importante queda registrada con quién la hizo y
cuándo, así que nunca se pierde el rastro de nada.

## 4. Cómo se vive PlentyPay, día a día

- **Un negocio nuevo se une**: se da de alta, configura su catálogo y su
  primera sucursal, y en minutos ya puede cobrar su primera venta.
- **Un día cualquiera en una tienda física**: se venden productos toda la
  mañana, algunos clientes pagan con tarjeta, otros con su teléfono, otros en
  efectivo — todo entra al mismo cierre de caja al final del día.
- **Un cliente descubre algo en el mercado compartido** desde su casa, compra
  productos de dos negocios distintos en un solo pago, y sigue su entrega en
  tiempo real hasta que llega a su puerta.
- **Un cliente paga acercando el teléfono** en el mostrador de su cafetería
  de siempre, sin sacar la tarjeta ni el efectivo.
- **El dueño del negocio**, sin estar físicamente ahí, revisa desde su
  teléfono cómo le fue la semana, qué producto se está agotando, y cuánto le
  queda por liquidar de las ventas de la semana.
- **Un repartidor** recibe el pedido asignado, lo recoge, lo entrega, y en
  cada paso el cliente ve el avance sin tener que llamar a preguntar.

## 5. La aplicación que se instala

Una sola aplicación — la misma para todos — disponible para teléfonos
(tanto Android como iPhone) y para computadoras de escritorio (tanto Windows
como Mac). La misma cuenta funciona en cualquiera de esos dispositivos, así
que un negocio puede tener la caja en una computadora y al dueño revisando
todo desde su teléfono, sin que se sientan como dos sistemas distintos.
Existe un modo de pantalla completa pensado para dejarse fijo como quiosco
de marcaje o como punto de venta permanente, y una vista pensada
específicamente para mostrarle su total al cliente en el mostrador. Como ya
se mencionó, la aplicación sigue funcionando aunque el internet falle un
momento, y se pone al día sola en cuanto la conexión regresa.

## 6. Seguridad y confianza

Toda la información sensible viaja y se guarda cifrada. El número completo
de una tarjeta **nunca** queda guardado en PlentyPay: cada pago con tarjeta
pasa por un proceso certificado, diseñado específicamente para proteger ese
dato, de forma que ni un error interno pudiera exponerlo. Cada movimiento de
dinero queda en un registro permanente que no se puede alterar después de
ocurrido, y los pagos de mayor valor pueden pedir una confirmación adicional
con la huella o el rostro de quien está pagando — la misma seguridad con la
que se protege el acceso a una cuenta bancaria.

## 7. Hecho para crecer

PlentyPay está pensado, desde el diseño, para que cientos de miles de
personas lo usen todos los días sin que nada se sienta lento. Cada parte de
la plataforma puede reforzarse por separado según haga falta: si un día hay
mucha más gente pagando que comprando, esa parte específica se refuerza sin
tener que tocar el resto del sistema — como agregar más cajas en un
supermercado sin tener que remodelar toda la tienda.

## 8. Lo que hace distinto a PlentyPay

PlentyPay no hereda nada de ningún sistema anterior con otro nombre: es una
plataforma pensada de una sola vez para que vender, cobrar, pagar, entregar
y crecer sean parte de la misma experiencia — no un punto de venta con
pagos pegados encima, ni una app de pagos con un catálogo agregado después.
Un negocio que usa PlentyPay no administra varias herramientas que
"se hablan entre sí": administra una sola plataforma que ya nació completa.
