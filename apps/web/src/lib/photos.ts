/**
 * Curated Unsplash photography (free to use under the Unsplash License; credit is given anyway).
 * Images are served straight from the Unsplash CDN with on-the-fly resizing.
 */
export interface PhotoInfo {
  id: string;
  alt: string;
  author: string;
  /** Dominant colour, used as the placeholder while loading. */
  tone: string;
  /** Natural aspect ratio (w/h). */
  ratio: number;
}

const p = (id: string, alt: string, author: string, tone: string, ratio = 1.5): PhotoInfo => ({ id, alt, author, tone, ratio });

export const PHOTOS = {
  roverBench: p("photo-1678225867994-e7a5b071ebfd", "A small wheeled robot car with an Arduino, wires and a distance sensor", "Gabriel Vasiliu", "#2b5f8c"),
  trackedRover: p("photo-1558137623-ce933996c730", "A tracked robot rover on a desk", "Marília Castelli", "#4a2a6e", 1.39),
  mecanumRover: p("photo-1775826476139-b5968f28ebdb", "A complex robot with yellow mecanum wheels", "Shivansh Upadhyay", "#6f6a60", 0.75),
  robotCarCase: p("photo-1643199329419-1e46bbacf76c", "A small robot car next to a metal case", "RUT MIIT", "#7fa0c4"),
  legoRobots: p("photo-1518314916381-77a37c2a49ae", "Two wheeled robots built from construction kits", "Jelleke Vanooteghem", "#c9c9c9"),
  childRobotHand: p("photo-1682159672286-40790338349b", "A child touching the finger of a white robotic hand", "Katja Ano", "#3a3d45", 1.65),
  robotHand: p("photo-1531746790731-6c087fecd65a", "Close-up of a white robotic hand", "Franck V.", "#e6e6e6", 1.39),
  robotArmStudio: p("photo-1655393001768-d946c97d6fd1", "A white robotic arm in a bright studio", "ZHENYU LUO", "#e9edf0"),
  pepper: p("photo-1485827404703-89b55fcc595e", "A white humanoid robot looking at the camera", "Alex Knight", "#8a6a4f"),
  studentsLab: p("photo-1581092160607-ee22621dd758", "Engineering students working with machinery in a lab", "ThisisEngineering", "#4d6b85"),
  drawings: p("photo-1581092160562-40aa08e78837", "Measuring technical drawings with a caliper", "ThisisEngineering", "#d9d5cc"),
  arduinoFlat: p("photo-1603732551658-5fabbafa84eb", "An Arduino board and components on a blue surface", "Sahand Babali", "#2f9fd8"),
  arduinoUno: p("photo-1553406830-ef2513450d76", "Close-up of an Arduino Uno", "Harrison Broadbent", "#1e5f7a", 1.78),
  wiredBoard: p("photo-1631378297854-185cff6b0986", "A microcontroller board with jumper wires attached", "Vishnu Mohanan", "#2a4f7a", 1.33),
  componentsFlat: p("photo-1555664424-778a1e5e1b48", "Flat lay of electronic components and breadboards", "Robin Glauser", "#e7e3dc"),
  handsOnBoard: p("photo-1669225313299-dcae29b817e8", "Hands working on a circuit board", "Sebastien Bonneval", "#e9e6e1", 1.33),
  breadboard: p("photo-1775457480933-a9ca6953ef69", "A breadboard full of components and wires", "Moe Salih", "#51606b"),
  workshop3d: p("photo-1756723902460-235b1f21ad05", "A maker workshop with a 3D printer, tools and creations", "Snapmaker", "#5b3f2a"),
  workshopDesk: p("photo-1756723902363-25de2ac0ffae", "A maker working at a computer in a workshop", "Snapmaker", "#6a4a31"),
  motherboard: p("photo-1517077304055-6e89abbf09b0", "Tilt-shift view of a green circuit board", "Chris Ried", "#1f5c3a"),
} satisfies Record<string, PhotoInfo>;

export type PhotoKey = keyof typeof PHOTOS;

/** Unsplash CDN URL, cropped to the requested size. */
export function unsplash(id: string, w: number, h?: number, q = 78): string {
  const size = h ? `&h=${h}&fit=crop&crop=entropy` : "&fit=max";
  return `https://images.unsplash.com/${id}?auto=format&w=${w}${size}&q=${q}`;
}

export function srcSet(id: string, widths = [480, 800, 1200, 1800, 2400]): string {
  return widths.map((w) => `${unsplash(id, w)} ${w}w`).join(", ");
}
