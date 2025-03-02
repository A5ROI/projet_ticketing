#Elisee
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(subject: str, recipient: str, body: str):
    sender_email = "chriazo01@gmail.com"
    sender_password = "xenc egnt tyoc gfdu"
    smtp_server = "smtp.gmail.com"
    smtp_port = 587

    msg = MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        # Connexion au serveur SMTP de Gmail
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()  # Sécurisation de la connexion
            server.login(sender_email, sender_password)  # Connexion avec email et mot de passe d'application
            server.sendmail(sender_email, recipient, msg.as_string())  # Envoi de l'email
            print("Email envoyé avec succès !")  # Cette ligne sera exécutée si l'email est envoyé correctement.
    except smtplib.SMTPAuthenticationError as e:
        # Si l'authentification échoue, afficher une erreur
        print(f"Erreur d'authentification SMTP: {e}")
    except Exception as e:
        # Si une autre erreur se produit, afficher l'exception
        print(f"Erreur lors de l'envoi de l'email : {e}")
    finally:
        # Le bloc finally sera toujours exécuté, même si une exception est levée ou non
        print("Fin de l'envoi d'email.")