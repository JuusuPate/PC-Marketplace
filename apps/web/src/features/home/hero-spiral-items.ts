import gpu from "../../assets/listings/rtx-4070-super.png";
import amdGpu from "../../assets/listings/rx-7900-xtx.png";
import cpu from "../../assets/listings/ryzen-7800x3d.png";
import memory from "../../assets/listings/kingston-fury-ddr5.png";
import motherboard from "../../assets/listings/b650e-motherboard.png";
import keyboard from "../../assets/listings/keychron-q1-he.png";

// Decorative existing assets; replace these imports to supply your own hero images.
export const heroSpiralItems = [gpu, cpu, motherboard, memory, amdGpu, keyboard, gpu].map((src, index) => ({
  id: index,
  src,
  alt: "",
}));
