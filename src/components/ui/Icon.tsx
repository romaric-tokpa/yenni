"use client";
import {
  Landmark, Shield, House, PiggyBank, Globe, Flame, Bus, Bot,
  Monitor, Paperclip, Utensils, Car, Shirt, PartyPopper, Users,
  HeartPulse, Smartphone, BookOpen, Wrench, Target, Home, Truck,
  Laptop, Plane, GraduationCap, Gem, Hospital, Package, Gift,
  CircleHelp,
  type LucideProps,
} from "lucide-react";
import { ComponentType } from "react";

const iconMap: Record<string, ComponentType<LucideProps>> = {
  landmark: Landmark,
  shield: Shield,
  house: House,
  "piggy-bank": PiggyBank,
  globe: Globe,
  flame: Flame,
  bus: Bus,
  bot: Bot,
  monitor: Monitor,
  paperclip: Paperclip,
  utensils: Utensils,
  car: Car,
  shirt: Shirt,
  "party-popper": PartyPopper,
  users: Users,
  "heart-pulse": HeartPulse,
  smartphone: Smartphone,
  "book-open": BookOpen,
  wrench: Wrench,
  target: Target,
  home: Home,
  truck: Truck,
  laptop: Laptop,
  plane: Plane,
  "graduation-cap": GraduationCap,
  gem: Gem,
  hospital: Hospital,
  package: Package,
  gift: Gift,
};

interface IconProps extends LucideProps {
  name: string;
}

export default function Icon({ name, ...props }: IconProps) {
  const IconComponent = iconMap[name] || CircleHelp;
  return <IconComponent {...props} />;
}

export const PROJECT_ICON_NAMES = [
  "target", "home", "car", "laptop", "smartphone", "plane",
  "graduation-cap", "gem", "hospital", "package", "wrench", "gift",
];
