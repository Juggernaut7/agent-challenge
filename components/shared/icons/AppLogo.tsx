import React from "react";
import ElizaForgeIcon from "./ElizaForgeIcon";
import { cn } from "@/utils/cn";

interface AppLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: number;
}

const AppLogo: React.FC<AppLogoProps> = ({ 
  className, 
  iconOnly = false, 
  size = 32 
}) => {
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <ElizaForgeIcon 
        style={{ width: size, height: size }} 
        fill="#22C55E" // Accent Green for the icon in the logo
      />
      {!iconOnly && (
        <span className="text-xl font-bold tracking-tight text-text-primary">
          Eliza<span className="text-accent-primary">Forge</span>
        </span>
      )}
    </div>
  );
};

export default AppLogo;
