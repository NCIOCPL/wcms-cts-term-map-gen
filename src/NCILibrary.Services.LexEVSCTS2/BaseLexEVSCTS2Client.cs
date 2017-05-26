using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace NCI.Services.LexEVSCTS2
{
    /// <summary>
    /// Abstract class for Lex EVS CTS2 Clients
    /// </summary>
    public abstract class BaseLexEVSCTS2Client
    {

        public BaseLexEVSCTS2Client()
        {

        }

        /// <summary>
        /// Calls the LexEVS Read Entity endpoint
        /// </summary>
        /// <param name="codeSystem"></param>
        /// <param name="codeSystemVersion"></param>
        /// <param name="entityID"></param>
        public abstract Task<JToken> ReadEntityAsync(string codeSystem, string codeSystemVersion, string entityID);

        public abstract Task<JToken> GetChildrenAssociations(string codeSystem, string codeSystemVersion, string entityID);
    }
}
