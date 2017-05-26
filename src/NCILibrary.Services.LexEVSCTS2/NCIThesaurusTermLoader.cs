using Common.Logging;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NCI.Services.LexEVSCTS2
{
    /// <summary>
    /// Facade to interact with NCI Thesaurus
    /// </summary>
    public class NCIThesaurusTermLoader
    {
        static ILog log = LogManager.GetLogger(typeof(NCIThesaurusTermLoader)); 

        private Dictionary<string, ThesaurusTerm> _termCache = new Dictionary<string, ThesaurusTerm>();
        private LexEVSCTS2APIClient _client;
        private string _codeSystemVersion = string.Empty;
        private static readonly string CODE_SYSTEM = "NCI_Thesaurus";

        /// <summary>
        /// Create a new instance of a Term loader
        /// </summary>
        /// <param name="host">Lex EVS server name</param>
        /// <param name="codeSystemVersion">(Optional) The code version to use.  Defaults to 17.04d</param>
        public NCIThesaurusTermLoader(string host, string codeSystemVersion = "17.04d")
        {
            this._client = new LexEVSCTS2APIClient(host);
            //In the future we should look up what the current system is
            this._codeSystemVersion = codeSystemVersion;
        }

        /// <summary>
        /// Gets a thesaurus term.
        /// </summary>
        /// <param name="entityID"></param>
        /// <returns></returns>
        public async Task<ThesaurusTerm> GetTerm(string entityID)
        {
            ThesaurusTerm rtnTerm = null;

            if (this._termCache.ContainsKey(entityID))
            {
                rtnTerm = this._termCache[entityID];
            }
            else
            {
                rtnTerm = await this.InternalGetTerm(entityID);

                this._termCache.Add(entityID, rtnTerm);
            }
            
            return rtnTerm;
        }

        public async Task<ThesaurusTerm[]> GetChildTerms(string entityID)
        {
            string[] childIDs = await InternalGetChildIDs(entityID);

            ThesaurusTerm[] terms = await Task.WhenAll(childIDs.Select( childID => GetTerm(childID)));

            return terms;
        }

        private async Task<string[]> InternalGetChildIDs(string entityID)
        {
            try
            {
                dynamic entityDir = await this._client.GetChildrenAssociations(CODE_SYSTEM, this._codeSystemVersion, entityID);
                var dir = entityDir.EntityDirectory;

                if (dir.complete != "COMPLETE")
                {
                    throw new Exception(string.Format("Incomplete child list for term {0}", entityID));
                }

                string[] childIDs = { };

                if (dir.numEntries > 0)
                {
                    //Note: while dir.entry is not plural in the response object, it is an array.
                    childIDs = (
                        from entry in ((IEnumerable<dynamic>)dir.entry)
                        where ((string)entry.name.name).StartsWith("C") //Make sure it is a C-Code
                        select (string)entry.name.name
                    ).ToArray();
                }

                return childIDs;
            }
            catch (Exception ex) {
                log.Error(String.Format("Error Fetching Children for {0}", entityID));
                log.Info(ex.ToString()); 
            }

            return new string[] {};
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="entityID"></param>
        /// <returns></returns>
        private async Task<ThesaurusTerm> InternalGetTerm(string entityID)
        {
            ThesaurusTerm rtnTerm = null;

            try
            {
                dynamic entityMsg = await this._client.ReadEntityAsync(CODE_SYSTEM, this._codeSystemVersion, entityID);

                //namedEntity is where the data lives
                var entity = entityMsg.EntityDescriptionMsg.entityDescription.namedEntity;

                IEnumerable<dynamic> props = entity.property;

                string preferredName = this.ExtractFirstPropValue(props, "Preferred_Name");
                string displayName = this.ExtractFirstPropValue(props, "Display_Name");
                string childrenUrl = entity.children;

                rtnTerm = new ThesaurusTerm(entityID, preferredName, displayName, this._codeSystemVersion) { 
                    ChildrenUrl = childrenUrl 
                };

            }
            catch (TaskCanceledException canEx)
            {
                log.Error(String.Format("Error Fetching term for {0}", entityID));
                log.Info(canEx.ToString());
                throw canEx;
            }
            catch (Exception ex) {
                log.Error(String.Format("Error Fetching term for {0}", entityID));
                log.Info(ex.ToString()); 
            }

            return rtnTerm;
        }

        private string ExtractFirstPropValue(IEnumerable<dynamic> props, string propertyName)
        {
            string rtnStr = string.Empty;

            var matchedProp = props.Where(p => p.predicate.name == propertyName).FirstOrDefault();

            if (matchedProp != null)
            {
                rtnStr = matchedProp.value[0].literal.value;
            }

            return rtnStr;
        }
    }
}
