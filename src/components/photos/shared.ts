export type Pose = "face" | "profil" | "dos";
export const POSES: Pose[] = ["face", "profil", "dos"];
export const POSE_LABEL: Record<Pose, string> = { face: "Face", profil: "Profil", dos: "Dos" };
