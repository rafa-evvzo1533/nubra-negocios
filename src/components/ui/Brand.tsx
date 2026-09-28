import Image from "next/image";
import logo from "@/assets/images/nubranegocios.png";
export function Brand({ size = 80 }: { size?: number }) {
  return (
    <Image
      src={logo}
      alt="Nubra Negocios"
      width={size}
      height={size}
      style={{ objectFit: "contain", flexShrink: 0 }}
      priority
    />
  );
}
