import { useI18n } from "../../i18n";
import ProfilesCard from "./components/ProfilesCard";
import UsersCard from "./components/UsersCard";

export default function AdminAccessPage() {
  const { tx } = useI18n();

  return (
    <div className="td2-page space-y-4">
      <div>
        <div className="td2-heading text-lg font-semibold">{tx("Admin Acesso", "Admin Access")}</div>
        <div className="text-xs td2-subheading">
          {tx("Usuários, perfis e permissões (validadas no backend).", "Users, profiles and permissions (validated in backend).")}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <ProfilesCard tx={tx} />
        <UsersCard tx={tx} />
      </div>
    </div>
  );
}
