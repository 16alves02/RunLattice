import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = { variant?: "sidebar" | "auth" };

export function BrandLogo({ variant = "sidebar" }: BrandLogoProps) {
  return (
    <Link href="/" className={`brand brand-logo-link brand-logo-${variant}`} aria-label="RunLattice home">
      <Image src="/brand/runlattice-logo.svg" alt="RunLattice" width={1024} height={559} priority />
    </Link>
  );
}
