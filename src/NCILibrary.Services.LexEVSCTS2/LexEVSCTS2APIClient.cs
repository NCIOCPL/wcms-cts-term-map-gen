using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Common.Logging;
using System.Net.Http;
using Newtonsoft.Json.Linq;
using System.Net.Http.Headers;

namespace NCI.Services.LexEVSCTS2
{
    /// <summary>
    /// Wrapper to interface with NCI's Lex EVS CTS2 terminology service.
    /// </summary>
    public class LexEVSCTS2APIClient : BaseLexEVSCTS2Client
    {
        static ILog log = LogManager.GetLogger(typeof(LexEVSCTS2APIClient));        

        private HttpClient client;

        /// <summary>
        /// Property for the hostname that requests will be sent to.
        /// </summary>
        public string Host { get; private set; }

        public LexEVSCTS2APIClient(string host)
        {
            this.Host = host;
            this.client = new HttpClient();
            this.client.Timeout = TimeSpan.FromHours(1);
            this.client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="codeSystem"></param>
        /// <param name="codeSystemVersion"></param>
        /// <param name="entityID"></param>
        /// <returns></returns>
        public override async Task<JToken> ReadEntityAsync(string codeSystem, string codeSystemVersion, string entityID)
        {
            string url = String.Format("/lexevscts2/codesystem/{0}/version/{1}/entity/{2}?format=json", codeSystem, codeSystemVersion, entityID);

            JToken response = await this.GetEVSResponse(url);

            return response;
        }

        /// <summary>
        /// Gets the child associations for an entity
        /// </summary>
        /// <param name="codeSystem"></param>
        /// <param name="codeSystemVersion"></param>
        /// <param name="entityID"></param>
        /// <returns></returns>
        public override async Task<JToken> GetChildrenAssociations(string codeSystem, string codeSystemVersion, string entityID)
        {
            string url = String.Format("/lexevscts2/codesystem/{0}/version/{1}/entity/{2}/children?maxtoreturn=1000&format=json", codeSystem, codeSystemVersion, entityID);

            JToken response = await this.GetEVSResponse(url);

            return response;
        }

        /// <summary>
        /// Internal method that gets response from EVS service.  All responses are pretty much the same?
        /// </summary>
        /// <param name="urlPathWithParams"></param>
        /// <returns></returns>
        private async Task<JToken> GetEVSResponse(string urlPathWithParams)
        {
            HttpResponseMessage response = await this.client.GetAsync(string.Format("https://{0}{1}", this.Host, urlPathWithParams));
            dynamic content = await response.Content.ReadAsAsync<JToken>();

            try
            {
                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                throw new Exception("Status Code: " + response.StatusCode + "\r\nMessage: " + content[0].ToString(), ex);
            }

            return content;
        }

    }
}
