using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NCI.Services.LexEVSCTS2
{
    public class ThesaurusTerm
    {
        public string EntityID { get; private set; }
        public string DisplayName { get; private set; }
        public string PreferredName { get; private set; }
        public string CodeSystemVersion { get; private set; }
        internal string ChildrenUrl { get; set; }

        public ThesaurusTerm(string entityID, string preferredName, string displayName, string codeSystemVersion)
        {
            this.EntityID = entityID;
            this.PreferredName = preferredName;
            this.DisplayName = displayName;
            this.CodeSystemVersion = codeSystemVersion;
        }

        public override string ToString()
        {
            return string.Format("({0}) {1}", this.EntityID, this.PreferredName);
        }
    }
}
