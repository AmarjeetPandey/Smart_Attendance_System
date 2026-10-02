from pathlib import Path
import ipaddress
import os
import socket
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

cert_dir = Path(__file__).resolve().parent
ca_cert_path = cert_dir / "smart-attendance-local-ca.crt"
ca_key_path = cert_dir / "smart-attendance-local-ca.key"
server_cert_path = cert_dir / "smart-attendance-local-server.crt"
server_key_path = cert_dir / "smart-attendance-local-server.key"

def discover_network_ips():
    runtime_ips = []
    for host in (socket.gethostname(), "localhost"):
        try:
            runtime_ips.extend(socket.gethostbyname_ex(host)[2])
        except OSError:
            pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            local_ip = sock.getsockname()[0]
    except OSError:
        local_ip = "127.0.0.1"

    extra_ips = []
    for item in os.environ.get("ATTENDANCE_CERT_EXTRA_IPS", "").split(","):
        candidate = item.strip()
        if candidate:
            extra_ips.append(candidate)

    network_ips = [local_ip, "127.0.0.1", "172.16.28.35", "192.168.43.66", "10.33.182.66"] + runtime_ips + extra_ips
    unique_ips = []
    seen = set()
    for candidate in network_ips:
        try:
            ip = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if str(ip) not in seen:
            seen.add(str(ip))
            unique_ips.append(ip)
    return unique_ips


def cert_needs_refresh(cert_path, required_ips):
    if not cert_path.exists():
        return True
    try:
        cert = x509.load_pem_x509_certificate(cert_path.read_bytes())
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
        existing_ips = {str(ip) for ip in san.get_values_for_type(x509.IPAddress)}
        return not all(str(ip) in existing_ips for ip in required_ips)
    except Exception:
        return True


unique_ips = discover_network_ips()

if cert_needs_refresh(server_cert_path, unique_ips):
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "Smart Attendance Local CA"),
    ])
    now = datetime.now(timezone.utc)

    ca_builder = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=False,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False
        )
    )
    ca_cert = ca_builder.sign(ca_key, hashes.SHA256())

    ca_cert_path.write_text(ca_cert.public_bytes(serialization.Encoding.PEM).decode("utf-8"))
    ca_key_path.write_text(
        ca_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
    )

    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    alt_names = [x509.DNSName("localhost")]
    for ip in unique_ips:
        alt_names.append(x509.IPAddress(ip))

    server_builder = (
        x509.CertificateBuilder()
        .subject_name(server_subject)
        .issuer_name(ca_name)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName(alt_names), critical=False)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(server_key.public_key()), critical=False
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False
        )
    )
    server_cert = server_builder.sign(ca_key, hashes.SHA256())

    server_cert_path.write_text(server_cert.public_bytes(serialization.Encoding.PEM).decode("utf-8"))
    server_key_path.write_text(
        server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")
    )
