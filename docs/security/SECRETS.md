# Secrets

Claves privadas, tokens, credenciales, certificados, seeds y códigos maestros no deben almacenarse en el repositorio, documentación, fixtures ni logs. Los archivos locales deben excluirse, custodiarse fuera del árbol y rotarse cuando exista duda de exposición. La aplicación debe fallar de forma segura cuando un secreto requerido no esté disponible.
