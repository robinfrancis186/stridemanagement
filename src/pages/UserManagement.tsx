import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";

interface UserProfile {
    id: string;
    email: string | null;
    full_name: string;
    role: string;
}

const UserManagement = () => {
    const { role: currentUserRole } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null); // UID of user being updated

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // 1. Fetch profiles
            const profilesSnap = await getDocs(collection(db, "profiles"));
            const profilesMap = new Map<string, any>();
            profilesSnap.docs.forEach(doc => {
                profilesMap.set(doc.id, { id: doc.id, ...doc.data() });
            });

            // 2. Fetch roles
            const rolesSnap = await getDocs(collection(db, "user_roles"));
            const rolesMap = new Map<string, string>();
            rolesSnap.docs.forEach(doc => {
                rolesMap.set(doc.id, doc.data().role);
            });

            // Combine them
            const combinedUsers: UserProfile[] = [];
            profilesMap.forEach((profile, uid) => {
                combinedUsers.push({
                    id: uid,
                    email: profile.email || "—",
                    full_name: profile.full_name || "Unknown",
                    role: rolesMap.get(uid) || "member"
                });
            });

            setUsers(combinedUsers);
        } catch (error: any) {
            console.error("Error fetching users:", error);
            toast({
                title: "Failed to load users",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUserRole === "coe_admin") {
            fetchUsers();
        }
    }, [currentUserRole]);

    const handleRoleChange = async (userId: string, newRole: string) => {
        setUpdating(userId);
        try {
            if (newRole === "member") {
                // Remove the role document completely from Firestore if they are just a "member"
                await deleteDoc(doc(db, "user_roles", userId));
            } else {
                // Set their role to the selected value (e.g. coe_admin)
                await setDoc(doc(db, "user_roles", userId), {
                    user_id: userId,
                    role: newRole
                });
            }

            toast({
                title: "Role updated",
                description: `Successfully updated role to ${newRole}.`
            });

            // Update local state instead of doing a full refetch
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error: any) {
            toast({
                title: "Failed to update role",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setUpdating(null);
        }
    };

    if (currentUserRole !== "coe_admin") {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center p-8 text-center animate-fade-in">
                <ShieldAlert className="mb-4 h-16 w-16 text-warning" />
                <h2 className="font-display text-2xl font-bold">Access Denied</h2>
                <p className="mt-2 text-muted-foreground max-w-md">
                    You do not have the required permissions to view this page. Only COE Administrators can manage user roles.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">User Management</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage platform access and assign administrative privileges.</p>
                </div>
                <Button onClick={fetchUsers} variant="outline" size="sm" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Refresh
                </Button>
            </div>

            <Card className="shadow-card">
                <CardHeader>
                    <CardTitle className="font-display text-base">Registered Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-border/50">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>User Name</TableHead>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-medium">{u.full_name}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs font-mono">{u.id}</TableCell>
                                            <TableCell>
                                                <Select
                                                    disabled={updating === u.id}
                                                    value={u.role}
                                                    onValueChange={(val) => handleRoleChange(u.id, val)}
                                                >
                                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                                        <SelectValue placeholder="Select role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="member">Standard Member</SelectItem>
                                                        <SelectItem value="coe_admin">COE Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default UserManagement;
